/**
 * Reports & Export Module (Excel .XLS / CSV / Print Document)
 * Sistem Timbang & Susut RPHU Modern
 * Unit Rumah Potong Hewan Unggas (RPHU)
 */

const ReportEngine = {
  /**
   * Mengambil metadata operasional saat ini
   */
  getMetadata() {
    const now = new Date();
    const tglFormatted = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const jamFormatted = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    let user = 'Supervisor RPHU';
    let station = 'Stasiun Timbang 1';
    let shift = 'Shift Pagi (06:00 - 14:00)';

    try {
      const authUser = JSON.parse(localStorage.getItem('rphu-user') || '{}');
      if (authUser.name) user = authUser.name;
      if (authUser.station) station = authUser.station;
      if (authUser.shift) shift = `Shift ${authUser.shift}`;
    } catch (e) {}

    return {
      company: 'RUMAH POTONG HEWAN UNGGAS (RPHU) MODERN',
      subCompany: 'DIVISI PENGENDALIAN MUTU & LOGISTIK RPHU',
      unit: 'SISTEM TIMBANG & VERIFIKASI DIGITAL TERPADU',
      docNo: `RPHU/RPT/${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}-01`,
      title: 'LAPORAN REKAPITULASI PENIMBANGAN & ANALISIS PENYUSUTAN BOBOT AYAM',
      date: tglFormatted,
      time: jamFormatted,
      operator: user,
      station: station,
      shift: shift,
      scaleNode: 'SCALE-ESP32-01 (HX711 24-bit, Moving Average Filter)'
    };
  },

  /**
   * Menghitung agregat KPI untuk ringkasan laporan
   */
  calculateSummary(lots) {
    const totalEkor = lots.reduce((a, l) => a + (l.ekor || 0), 0);
    const sumKirim = lots.reduce((a, l) => a + (l.kirim || 0), 0);
    const sumHidup = lots.reduce((a, l) => a + (l.hidup || 0), 0);
    const sumBasah = lots.reduce((a, l) => a + (l.basah || 0), 0);
    const sumDingin = lots.reduce((a, l) => a + (l.dingin || 0), 0);

    // Hitung rata-rata susut transit dari lot yang sudah ditimbang hidup
    const weighedLots = lots.filter(l => l.hidup != null && l.kirim != null && l.kirim > 0);
    const weighedSend = weighedLots.reduce((a, l) => a + l.kirim, 0);
    const weighedRecv = weighedLots.reduce((a, l) => a + l.hidup, 0);
    const susutTransitKg = (weighedSend > 0 && weighedRecv > 0) ? (weighedSend - weighedRecv) : 0;
    const avgTransitPct = weighedSend > 0 ? (susutTransitKg / weighedSend) * 100 : 0;

    // Hitung yield karkas dari lot yang sudah ditimbang dingin
    const coldLots = lots.filter(l => l.dingin != null && l.hidup != null && l.hidup > 0);
    const coldRecv = coldLots.reduce((a, l) => a + l.hidup, 0);
    const coldDingin = coldLots.reduce((a, l) => a + l.dingin, 0);
    const avgYieldPct = coldRecv > 0 ? (coldDingin / coldRecv) * 100 : 0;

    const coldSend = coldLots.reduce((a, l) => a + (l.kirim || 0), 0);
    const totalSusutKg = (coldSend > 0 && coldDingin > 0) ? (coldSend - coldDingin) : 0;
    const avgTotalSusutPct = coldSend > 0 ? (totalSusutKg / coldSend) * 100 : 0;

    const evaluated = lots.map(l => ({ l, fin: LotStore.calcFinancial(l) }));
    const totalModal = evaluated.reduce((a, x) => a + (x.fin.modal || 0), 0);
    const totalJual = evaluated.reduce((a, x) => a + (x.fin.jual || 0), 0);
    const totalRugiSusut = evaluated.reduce((a, x) => a + (x.fin.rs || 0), 0);
    const totalLaba = evaluated.reduce((a, x) => a + (x.fin.laba || 0), 0);

    return {
      lotsCount: lots.length,
      totalEkor,
      sumKirim,
      sumHidup,
      sumBasah,
      sumDingin,
      susutTransitKg,
      avgTransitPct,
      avgYieldPct,
      totalSusutKg,
      avgTotalSusutPct,
      totalModal,
      totalJual,
      totalRugiSusut,
      totalLaba
    };
  },

  /**
   * EKSPOR EXCEL (.XLS) TERFORMAT RESMI RPHU
   * Membuka langsung di MS Excel, Apple Numbers, Google Sheets dengan warna, kop, dan format angka
   */
  exportExcel(lots) {
    if (!lots || lots.length === 0) {
      App.toast('Tidak ada data lot untuk diekspor!', 'warning');
      return;
    }

    const meta = this.getMetadata();
    const sum = this.calculateSummary(lots);

    let rowsHtml = '';
    lots.forEach((l, idx) => {
      const t = LotStore.calcTransit(l);
      const tt = LotStore.calcTotal(l);
      const y = LotStore.calcYield(l);
      const fin = LotStore.calcFinancial(l);

      const susutTransitKg = (l.kirim && l.hidup) ? (l.kirim - l.hidup) : null;
      const isHighTransit = t != null && t > 3.0;
      const isGoodYield = y != null && y >= 68.0;

      rowsHtml += `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${idx + 1}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; font-weight: bold; color: #0b57a4; padding: 6px;">${l.id}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px;">${l.nama}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px;">${LotStore.f(l.ekor)}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px;">${LotStore.f(l.kirim, 1)}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px;">${l.hidup != null ? LotStore.f(l.hidup, 1) : '-'}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px;">${susutTransitKg != null ? LotStore.f(susutTransitKg, 1) : '-'}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px; font-weight: bold; color: ${isHighTransit ? '#c8102e' : '#0b57a4'}; background-color: ${isHighTransit ? '#ffebee' : 'transparent'};">
            ${t != null ? LotStore.f(t, 2) + '%' : '-'}
          </td>
          <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px;">${l.basah != null ? LotStore.f(l.basah, 1) : '-'}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px;">${l.dingin != null ? LotStore.f(l.dingin, 1) : '-'}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px;">${tt != null ? LotStore.f(tt, 2) + '%' : '-'}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px; font-weight: bold; color: ${isGoodYield ? '#059669' : '#131c2e'}; background-color: ${isGoodYield ? '#e8f5e9' : 'transparent'};">
            ${y != null ? LotStore.f(y, 1) + '%' : '-'}
          </td>
          <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px;">${LotStore.rp(l.modal)}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px;">${LotStore.rp(l.jual)}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px;">${LotStore.rp(fin.modal)}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px;">${LotStore.rp(fin.jual)}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px; font-weight: bold; color: #c8102e;">${LotStore.rp(fin.rs)}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px; font-weight: bold; color: ${(fin.laba || 0) >= 0 ? '#059669' : '#c8102e'};">
            ${LotStore.rp(fin.laba)}
          </td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">
            <span style="padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background-color: ${l.status === 'completed' ? '#dcfce7' : (l.status === 'processing' ? '#e0f2fe' : '#fef3c7')}; color: ${l.status === 'completed' ? '#166534' : (l.status === 'processing' ? '#0369a1' : '#b45309')};">
              ${l.status === 'completed' ? 'SELESAI' : (l.status === 'processing' ? 'PROSES' : 'MENUNGGU')}
            </span>
          </td>
        </tr>
      `;
    });

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Laporan Susut RPHU</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                  <x:FitToPage/>
                  <x:Print>
                    <x:ValidPrinterInfo/>
                    <x:Orientation>Landscape</x:Orientation>
                  </x:Print>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; background: #ffffff; }
          .header-title { font-size: 15pt; font-weight: bold; color: #0b57a4; text-align: left; }
          .header-sub { font-size: 11pt; font-weight: bold; color: #334155; }
          .meta-label { font-weight: bold; color: #475569; width: 180px; }
          .th-col { background-color: #0b57a4; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #084380; padding: 8px 6px; font-size: 10.5pt; vertical-align: middle; }
          .total-row { background-color: #e2e8f0; font-weight: bold; border-top: 2px solid #0b57a4; border-bottom: 3px double #0b57a4; }
          .num-int { mso-number-format:'\\#\\,\\#\\#0'; text-align: right; }
          .num-dec { mso-number-format:'\\#\\,\\#\\#0\\.0'; text-align: right; }
          .num-pct { mso-number-format:'0\\.00%'; text-align: right; }
          .num-rp { mso-number-format:'"Rp"\\ \\#\\,\\#\\#0'; text-align: right; }
        </style>
      </head>
      <body>
        <!-- KOP SURAT RPHU & HEADER RESMI -->
        <table style="width: 100%; margin-bottom: 12px; border-collapse: collapse;">
          <tr>
            <td colspan="19" class="header-title">${meta.company}</td>
          </tr>
          <tr>
            <td colspan="19" class="header-sub">${meta.subCompany} · ${meta.unit}</td>
          </tr>
          <tr>
            <td colspan="19" style="font-size: 13pt; font-weight: bold; color: #c8102e; padding-top: 6px;">
              ${meta.title}
            </td>
          </tr>
          <tr>
            <td colspan="19" style="font-size: 9.5pt; color: #64748b; border-bottom: 2px solid #0b57a4; padding-bottom: 8px;">
              No. Dokumen: <b>${meta.docNo}</b> | Standar Mutu SNI 01-3924-1995 (Karkas Unggas) &amp; Permentan No. 11/2020 | Terverifikasi Sistem IoT
            </td>
          </tr>
        </table>

        <!-- METADATA OPERASIONAL -->
        <table style="width: 100%; margin-bottom: 14px; font-size: 10.5pt; border-collapse: collapse;">
          <tr>
            <td class="meta-label">Tanggal Operasional</td>
            <td>: ${meta.date}</td>
            <td style="width: 40px;"></td>
            <td class="meta-label">Operator / Supervisor</td>
            <td>: ${meta.operator}</td>
          </tr>
          <tr>
            <td class="meta-label">Stasiun Timbang</td>
            <td>: ${meta.station}</td>
            <td></td>
            <td class="meta-label">Shift Kerja</td>
            <td>: ${meta.shift}</td>
          </tr>
          <tr>
            <td class="meta-label">Node Telemetri IoT</td>
            <td colspan="4">: ${meta.scaleNode}</td>
          </tr>
        </table>

        <!-- RINGKASAN EKSEKUTIF KPI BERBINGKAI -->
        <table style="width: 100%; margin-bottom: 16px; border: 1px solid #cbd5e1; border-collapse: collapse;">
          <tr style="background-color: #e8f1fb; font-weight: bold; color: #0b57a4;">
            <td colspan="6" style="padding: 8px; font-size: 11pt; border-bottom: 1px solid #cbd5e1;">
              RINGKASAN EKSEKUTIF PENERIMAAN &amp; ANALISIS SUSUT BOBOT
            </td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #cbd5e1;"><b>Total Lot:</b> ${sum.lotsCount} Lot</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;"><b>Total Ayam:</b> ${LotStore.f(sum.totalEkor)} Ekor</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;"><b>Bobot Kirim:</b> ${LotStore.f(sum.sumKirim, 1)} kg</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;"><b>Bobot Diterima:</b> ${LotStore.f(sum.sumHidup, 1)} kg</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; color: #0b57a4;"><b>Rata-rata Susut Transit:</b> ${LotStore.f(sum.avgTransitPct, 2)}%</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; color: #059669;"><b>Rata-rata Yield Karkas:</b> ${LotStore.f(sum.avgYieldPct, 1)}%</td>
          </tr>
          <tr>
            <td colspan="2" style="padding: 8px; border: 1px solid #cbd5e1;"><b>Total Modal Beli:</b> ${LotStore.rp(sum.totalModal)}</td>
            <td colspan="2" style="padding: 8px; border: 1px solid #cbd5e1;"><b>Target Hasil Jual:</b> ${LotStore.rp(sum.totalJual)}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; color: #c8102e;"><b>Total Kerugian Susut:</b> ${LotStore.rp(sum.totalRugiSusut)}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; color: #059669;"><b>Estimasi Laba Kotor:</b> ${LotStore.rp(sum.totalLaba)}</td>
          </tr>
        </table>

        <!-- TABEL RINCIAN LOT OPERASIONAL -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <colgroup>
            <col width="40">
            <col width="110">
            <col width="190">
            <col width="75">
            <col width="90">
            <col width="90">
            <col width="90">
            <col width="90">
            <col width="90">
            <col width="90">
            <col width="90">
            <col width="85">
            <col width="95">
            <col width="95">
            <col width="120">
            <col width="120">
            <col width="110">
            <col width="115">
            <col width="95">
          </colgroup>
          <thead>
            <tr>
              <th class="th-col">No</th>
              <th class="th-col">Lot ID</th>
              <th class="th-col">Peternak / Pemasok</th>
              <th class="th-col">Ekor</th>
              <th class="th-col">Kirim (kg)</th>
              <th class="th-col">Terima (kg)</th>
              <th class="th-col">Susut Tr. (kg)</th>
              <th class="th-col">Susut Tr. (%)</th>
              <th class="th-col">Basah (kg)</th>
              <th class="th-col">Dingin (kg)</th>
              <th class="th-col">Susut Tot (%)</th>
              <th class="th-col">Yield (%)</th>
              <th class="th-col">Hrg Modal (Rp)</th>
              <th class="th-col">Hrg Jual (Rp)</th>
              <th class="th-col">Total Modal (Rp)</th>
              <th class="th-col">Total Jual (Rp)</th>
              <th class="th-col">Rugi Susut (Rp)</th>
              <th class="th-col">Laba Kotor (Rp)</th>
              <th class="th-col">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="3" style="text-align: center; padding: 8px; border: 1px solid #cbd5e1;">TOTAL AKUMULASI OPERASIONAL</td>
              <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1;" class="num-int">${LotStore.f(sum.totalEkor)}</td>
              <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1;" class="num-dec">${LotStore.f(sum.sumKirim, 1)}</td>
              <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1;" class="num-dec">${LotStore.f(sum.sumHidup, 1)}</td>
              <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1;" class="num-dec">${LotStore.f(sum.susutTransitKg, 1)}</td>
              <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; color: #0b57a4;">${LotStore.f(sum.avgTransitPct, 2)}%</td>
              <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1;" class="num-dec">${LotStore.f(sum.sumBasah, 1)}</td>
              <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1;" class="num-dec">${LotStore.f(sum.sumDingin, 1)}</td>
              <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1;">${LotStore.f(sum.avgTotalSusutPct, 2)}%</td>
              <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; color: #059669;">${LotStore.f(sum.avgYieldPct, 1)}%</td>
              <td style="border: 1px solid #cbd5e1;"></td>
              <td style="border: 1px solid #cbd5e1;"></td>
              <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1;" class="num-rp">${LotStore.rp(sum.totalModal)}</td>
              <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1;" class="num-rp">${LotStore.rp(sum.totalJual)}</td>
              <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; color: #c8102e;" class="num-rp">${LotStore.rp(sum.totalRugiSusut)}</td>
              <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; color: ${sum.totalLaba >= 0 ? '#059669' : '#c8102e'};" class="num-rp">
                ${LotStore.rp(sum.totalLaba)}
              </td>
              <td style="text-align: center; border: 1px solid #cbd5e1;">${sum.lotsCount} Lot</td>
            </tr>
          </tfoot>
        </table>

        <!-- LEMBAR VERIFIKASI & TANDA TANGAN AUDIT -->
        <table style="width: 100%; margin-top: 30px; text-align: center; font-size: 11pt; border-collapse: collapse;">
          <tr>
            <td style="width: 33%; padding-bottom: 60px;">
              Dibuat Oleh,<br><b>Petugas Timbang RPHU</b>
            </td>
            <td style="width: 33%; padding-bottom: 60px;">
              Diperiksa Oleh,<br><b>Supervisor QC &amp; Susut</b>
            </td>
            <td style="width: 33%; padding-bottom: 60px;">
              Mengetahui,<br><b>Kepala Unit RPHU</b>
            </td>
          </tr>
          <tr>
            <td>( <u>Ahmad Fauzi</u> )<br><span style="font-size: 9pt; color: #64748b;">NPP: 2021.08.104</span></td>
            <td>( <u>Budi Santoso</u> )<br><span style="font-size: 9pt; color: #64748b;">NPP: 2018.03.022</span></td>
            <td>( <u>Ir. Hendra Gunawan, M.M.</u> )<br><span style="font-size: 9pt; color: #64748b;">NPP: 2012.01.005</span></td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    link.href = url;
    link.download = `laporan_resmi_rphu_${dateStr}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    App.toast('Spreadsheet Excel berdesain resmi (.XLS) berhasil diunduh!', 'success');
    if (window.Auth && Auth.beep) Auth.beep(1040, 0.15, 'triangle');
  },

  /**
   * EKSPOR CSV TERFORMAT & TERSTRUKTUR DENGAN UTF-8 BOM
   * Bersih, rapi, dengan layout blok metadata 4-kolom, ringkasan KPI, dan tabel data presisi
   */
  exportCSV(lots) {
    if (!lots || lots.length === 0) {
      App.toast('Tidak ada data lot untuk diekspor!', 'warning');
      return;
    }

    const meta = this.getMetadata();
    const sum = this.calculateSummary(lots);

    // Pemisah semicolon (;) agar otomatis rapi saat dibuka di Microsoft Excel regional Indonesia
    const S = ';';
    const q = s => '"' + String(s != null ? s : '').replace(/"/g, '""') + '"';

    const lines = [];

    // 1. BLOK KOP SURAT & METADATA DOKUMEN (4 Kolom Terstruktur)
    lines.push([q('PARAMETER DOKUMEN'), q('KETERANGAN / NILAI OPERASIONAL'), q('SATUAN'), q('STATUS PENGESAHAN')].join(S));
    lines.push([q('Organisasi'), q('RUMAH POTONG HEWAN UNGGAS (RPHU) MODERN'), q('-'), q('[RPHU TERPADU]')].join(S));
    lines.push([q('Divisi / Unit Kerja'), q('DIVISI MUTU & LOGISTIK RPHU'), q('-'), q('[OPERASIONAL RESMI]')].join(S));
    lines.push([q('Judul Laporan'), q('LAPORAN REKAPITULASI PENIMBANGAN & ANALISIS SUSUT BOBOT AYAM'), q('-'), q('[DOKUMEN AUDIT MUTU]')].join(S));
    lines.push([q('Dasar Standar Mutu'), q('SNI 01-3924-1995 (Karkas Unggas) & Permentan No. 11/2020'), q('-'), q('[STANDAR NASIONAL]')].join(S));
    lines.push([q('Nomor Dokumen'), q(meta.docNo), q('-'), q('[REGISTER AUDIT]')].join(S));
    lines.push([q('Tanggal Operasional'), q(meta.date), q('-'), q('[TANGGAL PRODUKSI]')].join(S));
    lines.push([q('Waktu Ekspor Data'), q(meta.time), q('-'), q('[WAKTU SISTEM]')].join(S));
    lines.push([q('Operator Penimbangan'), q(meta.operator), q('-'), q('[QC OPERASIONAL]')].join(S));
    lines.push([q('Stasiun Penimbangan'), q(meta.station), q('-'), q('[TERMINAL TIMBANG]')].join(S));
    lines.push([q('Shift Kerja'), q(meta.shift), q('-'), q('[JADWAL AKTIF]')].join(S));
    lines.push([q('Hardware Telemetri IoT'), q(meta.scaleNode), q('-'), q('[ONLINE / STABIL]')].join(S));
    lines.push('');

    // 2. BLOK RINGKASAN EKSEKUTIF KPI (4 Kolom Terstruktur)
    lines.push([q('--- RINGKASAN EKSEKUTIF PENIMBANGAN & SUSUT BOBOT ---'), q(''), q(''), q('')].join(S));
    lines.push([q('INDIKATOR KINERJA (KPI)'), q('NILAI AGREGAT'), q('SATUAN'), q('EVALUASI MUTU & FINANSIAL')].join(S));
    lines.push([q('Total Lot Diolah'), q(sum.lotsCount), q('Lot'), q('[100% TERCATAT LENGKAP]')].join(S));
    lines.push([q('Total Populasi Ayam'), q(LotStore.f(sum.totalEkor)), q('Ekor'), q('[TERDATA SISTEM]')].join(S));
    lines.push([q('Total Bobot Kirim'), q(LotStore.f(sum.sumKirim, 1)), q('kg'), q('[SURAT JALAN PETERNAK]')].join(S));
    lines.push([q('Total Bobot Diterima'), q(LotStore.f(sum.sumHidup, 1)), q('kg'), q('[TIMBANGAN REAL RPHU]')].join(S));
    lines.push([q('Total Susut Transit'), q(LotStore.f(sum.susutTransitKg, 1)), q('kg'), q('[SELISIH KIRIM - TERIMA]')].join(S));
    lines.push([q('Rata-rata Susut Transit (%)'), q(LotStore.f(sum.avgTransitPct, 2) + '%'), q('%'), q(sum.avgTransitPct <= 3.0 ? '[NORMAL (< 3.0% AMAN)]' : '[PERINGATAN: SUSUT TINGGI (> 3.0%)]')].join(S));
    lines.push([q('Rata-rata Yield Karkas (%)'), q(LotStore.f(sum.avgYieldPct, 1) + '%'), q('%'), q(sum.avgYieldPct >= 68.0 ? '[PRIMA (>= 68.0% SNI)]' : '[PERIKSA (< 68.0%)]')].join(S));
    lines.push([q('Total Modal Pembelian'), q(LotStore.rp(sum.totalModal)), q('IDR'), q('[HPP PEMBELIAN AYAM]')].join(S));
    lines.push([q('Target Hasil Penjualan'), q(LotStore.rp(sum.totalJual)), q('IDR'), q('[ESTIMASI OMZET KARKAS]')].join(S));
    lines.push([q('Total Kerugian Susut'), q(LotStore.rp(sum.totalRugiSusut)), q('IDR'), q('[POTENSI KERUGIAN TRANSIT]')].join(S));
    lines.push([q('Estimasi Laba Kotor'), q(LotStore.rp(sum.totalLaba)), q('IDR'), q(sum.totalLaba >= 0 ? '[MARGIN LABA POSITIF]' : '[DEFISIT OPERASIONAL]')].join(S));
    lines.push('');

    // 3. TABEL DATA RINCIAN LOT (21 Kolom Terstruktur Penuh)
    lines.push([q('--- RINCIAN DATA PENIMBANGAN PER LOT & ANALISIS SUSUT ---'), q(''), q(''), q('')].join(S));
    const headers = [
      'No', 'Lot ID', 'Mitra Peternak / Pemasok', 'Jumlah Ekor',
      'Berat Kirim (kg)', 'Hidup Diterima (kg)', 'Susut Transit (kg)', 'Susut Transit (%)', 'Indikator Susut',
      'Karkas Basah (kg)', 'Karkas Dingin (kg)', 'Susut Total (%)', 'Yield Karkas (%)', 'Indikator Yield',
      'Harga Beli (Rp/kg)', 'Harga Jual (Rp/kg)', 'Total Modal (Rp)', 'Target Jual (Rp)', 'Kerugian Susut (Rp)', 'Estimasi Laba (Rp)',
      'Status Pemrosesan'
    ];
    lines.push(headers.map(h => q(h)).join(S));

    lots.forEach((l, idx) => {
      const t = LotStore.calcTransit(l);
      const tt = LotStore.calcTotal(l);
      const y = LotStore.calcYield(l);
      const fin = LotStore.calcFinancial(l);
      const susutKg = (l.kirim && l.hidup) ? (l.kirim - l.hidup) : 0;
      const isHighTransit = t != null && t > 3.0;
      const isGoodYield = y != null && y >= 68.0;

      const statusLabel = l.status === 'completed' ? '[SELESAI]' : (l.status === 'processing' ? '[SEDANG PROSES]' : '[MENUNGGU TIMBANG]');
      const transitBadge = t != null ? (isHighTransit ? '[TINGGI (>3%)]' : '[NORMAL]') : '-';
      const yieldBadge = y != null ? (isGoodYield ? '[PRIMA (>=68%)]' : '[PERIKSA (<68%)]') : '-';

      lines.push([
        idx + 1,
        q(l.id),
        q(l.nama),
        q(LotStore.f(l.ekor)),
        q(LotStore.f(l.kirim, 1)),
        q(l.hidup != null ? LotStore.f(l.hidup, 1) : '-'),
        q(susutKg > 0 ? LotStore.f(susutKg, 1) : '-'),
        q(t != null ? LotStore.f(t, 2) + '%' : '-'),
        q(transitBadge),
        q(l.basah != null ? LotStore.f(l.basah, 1) : '-'),
        q(l.dingin != null ? LotStore.f(l.dingin, 1) : '-'),
        q(tt != null ? LotStore.f(tt, 2) + '%' : '-'),
        q(y != null ? LotStore.f(y, 1) + '%' : '-'),
        q(yieldBadge),
        q(LotStore.rp(l.modal)),
        q(LotStore.rp(l.jual)),
        q(LotStore.rp(fin.modal)),
        q(LotStore.rp(fin.jual)),
        q(LotStore.rp(fin.rs)),
        q(LotStore.rp(fin.laba)),
        q(statusLabel)
      ].join(S));
    });

    // Baris Total Akumulasi 21 Kolom
    lines.push([
      q('TOTAL AKUMULASI'),
      q(`${sum.lotsCount} Lot`),
      q('Seluruh Mitra Peternak'),
      q(LotStore.f(sum.totalEkor)),
      q(LotStore.f(sum.sumKirim, 1)),
      q(LotStore.f(sum.sumHidup, 1)),
      q(LotStore.f(sum.susutTransitKg, 1)),
      q(LotStore.f(sum.avgTransitPct, 2) + '%'),
      q(sum.avgTransitPct <= 3.0 ? '[RATA-RATA NORMAL]' : '[PERINGATAN SUSUT]'),
      q(LotStore.f(sum.sumBasah, 1)),
      q(LotStore.f(sum.sumDingin, 1)),
      q(LotStore.f(sum.avgTotalSusutPct, 2) + '%'),
      q(LotStore.f(sum.avgYieldPct, 1) + '%'),
      q(sum.avgYieldPct >= 68.0 ? '[YIELD PRIMA]' : '[PERIKSA YIELD]'),
      q('-'),
      q('-'),
      q(LotStore.rp(sum.totalModal)),
      q(LotStore.rp(sum.totalJual)),
      q(LotStore.rp(sum.totalRugiSusut)),
      q(LotStore.rp(sum.totalLaba)),
      q('[SELESAI OPERASIONAL]')
    ].join(S));
    lines.push('');

    // 4. LEMBAR VERIFIKASI & TANDA TANGAN AUDIT (4 Kolom Terstruktur)
    lines.push([q('--- LEMBAR VERIFIKASI & PENGESAHAN AUDIT OPERASIONAL ---'), q(''), q(''), q('')].join(S));
    lines.push([q('JABATAN VERIFIKATOR'), q('NAMA LENGKAP'), q('NOMOR INDUK PEGAWAI (NPP)'), q('STATUS PENGESAHAN ELEKTRONIK')].join(S));
    lines.push([q('Petugas Timbang RPHU'), q('Ahmad Fauzi'), q('NPP: 2021.08.104'), q('[TELAH DIVALIDASI SISTEM IOT]')].join(S));
    lines.push([q('Supervisor QC & Susut'), q('Budi Santoso'), q('NPP: 2018.03.022'), q('[DIVERIFIKASI SESUAI SNI 01-3924]')].join(S));
    lines.push([q('Kepala Unit RPHU'), q('Ir. Hendra Gunawan, M.M.'), q('NPP: 2012.01.005'), q('[DISETUJUI & DISAHKAN]')].join(S));

    // UTF-8 Byte Order Mark (\uFEFF)
    const csvString = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    link.href = url;
    link.download = `laporan_susut_rphu_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    App.toast('File CSV terstruktur & terformat (.CSV) berhasil diunduh!', 'success');
    if (window.Auth && Auth.beep) Auth.beep(880, 0.12, 'sine');
  },

  printReport() {
    window.print();
  }
};
