async function fetchAllAndExport() {
  const url = "https://fasih-sm.bps.go.id/app/api/analytic/api/v2/assignment/report-progress-by-responsibility";
  
  const baseBody = {
    surveyPeriodId: "fd68e454-ba45-4b85-8205-f3bf777ded24",
    surveyRoleId: "6d7d919a-45e5-4779-bb87-2905b49fd31a",
    size: 5,
    page: 0,
    search: "",
    target: "TARGET_ONLY",
    region: {
      region1Id: null, region2Id: null, region3Id: null,
      region4Id: null, region5Id: null, region6Id: null,
      region7Id: null, region8Id: null, region9Id: null, region10Id: null
    },
    regionSummaryLevel: 6
  };

  let allUsers = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    console.log(`Fetching page ${page + 1} of ${totalPages}...`);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "*/*",
        "Content-Type": "application/json",
        "X-XSRF-TOKEN": "e9b8106f-5538-41b1-b683-465860e49d81"
      },
      body: JSON.stringify({ ...baseBody, page })
    });

    if (!res.ok) {
      console.error(`❌ Page ${page} error ${res.status}:`, await res.text());
      break;
    }

    const json = await res.json();
    const content = json?.data?.content ?? [];
    allUsers = allUsers.concat(content);

    if (page === 0) {
      const total = json?.data?.totalElements ?? 92;
      totalPages = Math.ceil(total / baseBody.size);
      console.log(`Total petugas: ${total}, Total pages: ${totalPages}`);
    }

    page++;
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`✅ Total petugas fetched: ${allUsers.length}`);

  // ── Flatten regionSummary ──────────────────────────────────────
  // Kumpulkan semua status unik dulu
  const allStatuses = new Set();
  allUsers.forEach(user => {
    user.regionSummary?.forEach(region => {
      region.statusBreakdown?.forEach(s => allStatuses.add(s.status));
    });
  });
  const statusList = [...allStatuses].sort();

  // Buat baris flat
  const rows = [];
  allUsers.forEach(user => {
    const email = user.email ?? user.username ?? "";
    user.regionSummary?.forEach(region => {
      const statusMap = {};
      statusList.forEach(s => statusMap[s] = 0); // default 0
      region.statusBreakdown?.forEach(s => statusMap[s.status] = s.count);

      rows.push({
        email,
        regionCode: region.regionCode,
        total: region.total,
        ...statusMap
      });
    });
  });

  console.log(`Total baris CSV: ${rows.length}`);
  console.table(rows.slice(0, 5)); // preview 5 baris

  // ── Export CSV ────────────────────────────────────────────────
  const headers = ["email", "regionCode", "total", ...statusList];

  const csvRows = [
    headers.join(","),
    ...rows.map(row =>
      headers.map(h => {
        const val = String(row[h] ?? "").replace(/"/g, '""');
        return `"${val}"`;
      }).join(",")
    )
  ];

  const csvContent = "\uFEFF" + csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "region_summary.csv";
  a.click();

  return rows;
}

fetchAllAndExport();