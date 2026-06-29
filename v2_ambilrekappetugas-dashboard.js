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

      let retry = 0;
      let res;

      while (retry < 5) {

          res = await fetch(url, {
              method: "POST",
              headers: {
                  "Accept": "*/*",
                  "Content-Type": "application/json",
                  "X-XSRF-TOKEN": "a71d3961-2d68-4988-acd0-bae58ccdc995"
              },
              body: JSON.stringify({ ...baseBody, page })
          });

          if (res.ok) {
              break;
          }

          console.warn(
              `Page ${page + 1} gagal (${res.status}), retry ${retry + 1}/5`
          );

          retry++;

          await new Promise(r => setTimeout(r, 3000));
      }

      if (!res.ok) {
          console.error(`❌ Page ${page + 1} gagal setelah 5 percobaan.`);
          break;
      }

      const json = await res.json();
      const content = json?.data?.content ?? [];

      allUsers = allUsers.concat(content);

      if (page === 0) {
          const total = json?.data?.totalElements ?? 92;
          totalPages = Math.ceil(total / baseBody.size);

          console.log(
              `Total petugas: ${total}, Total pages: ${totalPages}`
          );
      }

      page++;

      await new Promise(r => setTimeout(r, 1000));
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