import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, fetchAllRows } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for serverless execution

interface GeoNodeDataset {
  id: number | string;
  uuid: string;
  title: string;
  name: string;
  owner__username?: string;
  owner_name?: string;
  date?: string;
  last_updated?: string;
  srid?: string;
  [key: string]: unknown;
}

interface GeoNodeOwner {
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface ParsedGeometryInfo {
  geometry: string;
  attrCount: number;
}

const GEONODE_BASE_URL = "https://jigd.kaltimprov.go.id";
const GEONODE_PAGE_SIZE = 1000;
const GEONODE_MAX_PAGES = 50;

/**
 * Ambil seluruh objek dari endpoint daftar GeoNode (format Tastypie: `meta` + `objects`)
 * halaman demi halaman (limit/offset) sampai `meta.total_count` terpenuhi, sehingga
 * tidak ada batas 1.000 dataset. `totalCount` bernilai null bila GeoNode tidak melaporkannya.
 */
async function fetchAllGeoNode<T>(
  path: string,
  timeoutMs?: number
): Promise<{ objects: T[]; totalCount: number | null }> {
  const objects: T[] = [];
  let totalCount: number | null = null;

  for (let page = 0, offset = 0; page < GEONODE_MAX_PAGES; page++) {
    const res = await fetch(
      `${GEONODE_BASE_URL}${path}?limit=${GEONODE_PAGE_SIZE}&offset=${offset}`,
      {
        headers: { Accept: "application/json", "User-Agent": "JIGD-Web-Monitoring/1.0" },
        signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
        next: { revalidate: 0 },
      }
    );
    if (!res.ok) {
      throw new Error(`GeoNode API responded with HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    const pageObjects: T[] = json.objects || [];
    objects.push(...pageObjects);

    const total = Number(json.meta?.total_count ?? json.total);
    if (Number.isFinite(total)) totalCount = total;

    // GeoNode bisa membatasi limit di bawah yang diminta, jadi offset maju sebanyak data yang diterima.
    offset += pageObjects.length;
    const reachedEnd =
      pageObjects.length === 0 ||
      (totalCount !== null ? objects.length >= totalCount : pageObjects.length < GEONODE_PAGE_SIZE);
    if (reachedEnd) break;
  }

  return { objects, totalCount };
}

/**
 * Lightweight XML parser for DescribeFeatureType using regex
 * Preserved directly from the Google Apps Script implementation
 */
function parseDescribeXml(content: string): ParsedGeometryInfo {
  // Geometry: search for gml:...PropertyType across XML
  const geomMatch = content.match(
    /type\s*=\s*["'](?:[^:]+:)?([A-Za-z]+PropertyType)["']/i
  );
  let geometry = "Tidak Diketahui";

  if (geomMatch && geomMatch[1]) {
    const g = geomMatch[1].toLowerCase();
    if (g.includes("point")) geometry = "Titik";
    else if (g.includes("linestring")) geometry = "Garis";
    else if (g.includes("polygon")) geometry = "Poligon";
    else if (g.includes("geometrypropertytype")) geometry = "Poligon";
    else geometry = "Tidak Diketahui";
  }

  // Attribute count: match <xsd:sequence> ... </xsd:sequence> and count <xsd:element
  const seqMatch = content.match(
    /<xsd:sequence[^>]*>([\s\S]*?)<\/xsd:sequence>/i
  );
  let attrCount = 0;
  if (seqMatch && seqMatch[1]) {
    const elMatches = seqMatch[1].match(/<xsd:element\b/gi);
    attrCount = elMatches ? elMatches.length : 0;
  } else {
    // Fallback: count all xsd:element (minus 1 for global element if needed)
    const allEl = content.match(/<xsd:element\b/gi);
    attrCount = allEl ? Math.max(0, allEl.length - 1) : 0;
  }

  return { geometry, attrCount };
}

/**
 * Controlled Concurrency Worker Pool (simulating p-limit)
 */
async function pMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency = 15
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (currentIndex < items.length) {
        const index = currentIndex++;
        results[index] = await fn(items[index], index);
      }
    }
  );

  await Promise.all(workers);
  return results;
}

/**
 * Fetch DescribeFeatureType from GeoServer with per-request timeout
 */
async function fetchDescribeFeature(layerName: string): Promise<ParsedGeometryInfo> {
  try {
    const url = `https://jigd.kaltimprov.go.id/geoserver/ows?service=WFS&version=1.0.0&request=DescribeFeatureType&typeName=${encodeURIComponent(
      layerName
    )}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000), // 8 seconds timeout per layer
      headers: {
        Accept: "text/xml, application/xml",
        "User-Agent": "JIGD-Web-Monitoring/1.0",
      },
    });

    if (!res.ok) {
      return { geometry: "Tidak Diketahui", attrCount: 0 };
    }

    const xmlText = await res.text();
    return parseDescribeXml(xmlText);
  } catch (error) {
    console.warn(`[DescribeFeatureType] Failed for ${layerName}:`, error instanceof Error ? error.message : error);
    return { geometry: "Tidak Diketahui", attrCount: 0 };
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json(
        {
          success: false,
          error: "Supabase environment variables are missing. Please verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        },
        { status: 500 }
      );
    }

    // Use the caller's session (cookies) so writes run as the logged-in user,
    // and reject anonymous callers: the sync button only lives on the protected dashboard.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Sesi login diperlukan untuk menjalankan sinkronisasi." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("force") === "true";

    // 1. Fetch current cache from Supabase to prevent redundant GeoServer calls
    const { data: existingCache, error: cacheErr } = await fetchAllRows<{
      id_dataset: string;
      last_updated: string | null;
      geometry_type: string | null;
      attribute_count: number | null;
    }>((from, to) =>
      supabase
        .from("cache_layer_geoportal")
        .select("id_dataset, last_updated, geometry_type, attribute_count")
        .order("id_dataset", { ascending: true })
        .range(from, to)
    );

    if (cacheErr) {
      console.error("[Sync JIGD] Error reading cache_layer_geoportal:", cacheErr);
    }

    const cacheMap = new Map<
      string,
      { last_updated: string; geometry_type: string; attribute_count: number }
    >();

    if (existingCache) {
      for (const item of existingCache) {
        if (item.id_dataset) {
          cacheMap.set(String(item.id_dataset), {
            last_updated: item.last_updated || "",
            geometry_type: item.geometry_type || "Tidak Diketahui",
            attribute_count: item.attribute_count ?? 0,
          });
        }
      }
    }

    // 2. Fetch all datasets from GeoNode API (paginated)
    let datasets: GeoNodeDataset[];
    let totalCount: number | null;
    try {
      ({ objects: datasets, totalCount } = await fetchAllGeoNode<GeoNodeDataset>("/api/datasets/"));
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Gagal mengambil data GeoNode" },
        { status: 502 }
      );
    }

    if (!datasets.length) {
      return NextResponse.json({
        success: true,
        synced_count: 0,
        message: "No datasets found in GeoNode response",
      });
    }

    // 3. Identify layers requiring DescribeFeatureType query
    // If cache is missing, last_updated changed, or forceRefresh is enabled
    const layersToQuery: { id: string; name: string; last_updated: string }[] = [];

    for (const ds of datasets) {
      const id = String(ds.id);
      const lu = (ds.last_updated || ds.date || "") as string;
      const cached = cacheMap.get(id);

      const needsUpdate =
        forceRefresh ||
        !cached ||
        cached.last_updated !== lu ||
        cached.geometry_type === "Tidak Diketahui";

      if (needsUpdate) {
        layersToQuery.push({
          id,
          name: ds.name,
          last_updated: lu,
        });
      }
    }

    // 4. Concurrently query DescribeFeatureType with strict concurrency limit (15)
    if (layersToQuery.length > 0) {
      console.log(`[Sync JIGD] Querying DescribeFeatureType for ${layersToQuery.length} layers (concurrency: 15)...`);
      
      const queryResults = await pMap(
        layersToQuery,
        async (layer) => {
          const parsed = await fetchDescribeFeature(layer.name);
          return {
            id: layer.id,
            last_updated: layer.last_updated,
            geometry_type: parsed.geometry,
            attribute_count: parsed.attrCount,
          };
        },
        15
      );

      // Update local cacheMap with the fresh results
      for (const res of queryResults) {
        cacheMap.set(res.id, {
          last_updated: res.last_updated,
          geometry_type: res.geometry_type,
          attribute_count: res.attribute_count,
        });
      }
    }

    // 5. Construct database records for UPSERT
    const recordsToUpsert = datasets.map((ds) => {
      const id = String(ds.id);
      const cache = cacheMap.get(id) || {
        geometry_type: "Tidak Diketahui",
        attribute_count: 0,
        last_updated: (ds.last_updated || ds.date || "") as string,
      };

      return {
        id_dataset: id,
        uuid: ds.uuid || "",
        title: ds.title || ds.name || "Untitled Dataset",
        name: ds.name || "",
        owner_username: ds.owner__username || "",
        owner_name: (ds.owner_name || ds.owner__username || "") as string,
        date_published: (ds.date || "") as string,
        dataset_url: `https://jigd.kaltimprov.go.id/catalogue/#/dataset/${ds.id}`,
        srid: ds.srid || "N/A",
        geometry_type: cache.geometry_type,
        attribute_count: cache.attribute_count,
        last_updated: (ds.last_updated || ds.date || "") as string,
      };
    });

    // 6. Perform batch UPSERT into Supabase cache_layer_geoportal in chunks of 100
    const CHUNK_SIZE = 100;
    for (let i = 0; i < recordsToUpsert.length; i += CHUNK_SIZE) {
      const chunk = recordsToUpsert.slice(i, i + CHUNK_SIZE);
      const { error: upsertErr } = await supabase
        .from("cache_layer_geoportal")
        .upsert(chunk, { onConflict: "id_dataset" });

      if (upsertErr) {
        console.error(`[Sync JIGD] Upsert error on chunk ${i / CHUNK_SIZE}:`, upsertErr);
        return NextResponse.json(
          {
            success: false,
            error: `Database upsert failed: ${upsertErr.message}`,
            details: upsertErr,
          },
          { status: 500 }
        );
      }
    }

    // 6b. Remove cached layers that no longer exist on GeoNode (deleted / re-uploaded).
    // Only when the GeoNode list is complete, so a truncated response never wipes the cache.
    let removedCount = 0;
    const isCompleteList = totalCount !== null && datasets.length >= totalCount;
    if (isCompleteList && !cacheErr) {
      const liveIds = new Set(datasets.map((ds) => String(ds.id)));
      const staleIds = existingCache
        .map((item) => String(item.id_dataset))
        .filter((id) => id && !liveIds.has(id));

      if (staleIds.length > 0) {
        const { error: deleteErr } = await supabase
          .from("cache_layer_geoportal")
          .delete()
          .in("id_dataset", staleIds);

        if (deleteErr) {
          console.error("[Sync JIGD] Error removing stale cached layers:", deleteErr);
        } else {
          removedCount = staleIds.length;
        }
      }
    }

    // 7. Auto-Sync OPDs into master_opd table
    // Extract unique owner__username and owner_name from datasets
    const opdMap = new Map<string, string>();
    for (const ds of datasets) {
      const username = ds.owner__username ? String(ds.owner__username).trim() : "";
      const rawName = (ds.owner_name || ds.owner__username || "") as string;
      const name = rawName.trim();
      if (username) {
        if (!opdMap.has(username) || (opdMap.get(username) === username && name !== username)) {
          opdMap.set(username, name || username);
        }
      }
    }

    // Also attempt to enrich with GeoNode /api/owners/ endpoint
    try {
      const { objects: owners } = await fetchAllGeoNode<GeoNodeOwner>("/api/owners/", 6000);
      for (const o of owners) {
        if (o.username && !opdMap.has(o.username)) {
          const fullName = [o.first_name, o.last_name].filter(Boolean).join(" ").trim();
          opdMap.set(o.username, fullName || o.username);
        }
      }
    } catch (e) {
      console.warn("[Sync JIGD] Note: owners API enrich skipped:", e instanceof Error ? e.message : e);
    }

    const opdRows = Array.from(opdMap.entries()).map(([username_jigd, nama_opd]) => ({
      username_jigd,
      nama_opd: nama_opd || username_jigd,
    }));

    // Hanya OPD baru yang ditambahkan. OPD yang sudah ada tidak diubah, supaya nama OPD
    // yang sudah dirapikan manual di database tidak tertimpa nama dari GeoNode.
    let newOpdCount = 0;
    const { data: existingOpds, error: existingOpdErr } = await supabase
      .from("master_opd")
      .select("username_jigd");

    if (existingOpdErr) {
      console.error("[Sync JIGD] Error reading master_opd:", existingOpdErr);
    } else {
      const knownUsernames = new Set(
        (existingOpds || []).map((o) => String(o.username_jigd || "").toLowerCase())
      );
      const newOpdRows = opdRows.filter((o) => !knownUsernames.has(o.username_jigd.toLowerCase()));

      if (newOpdRows.length > 0) {
        const { error: opdErr } = await supabase
          .from("master_opd")
          .upsert(newOpdRows, { onConflict: "username_jigd", ignoreDuplicates: true });

        if (opdErr) {
          console.error("[Sync JIGD] Error inserting new master_opd rows:", opdErr);
        } else {
          newOpdCount = newOpdRows.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      synced_count: recordsToUpsert.length,
      opd_count: opdRows.length,
      new_opd_count: newOpdCount,
      removed_count: removedCount,
      queried_layers: layersToQuery.length,
      cached_layers: datasets.length - layersToQuery.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Sync JIGD] Unexpected sync error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
