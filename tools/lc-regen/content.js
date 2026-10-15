// Learning Center content v2 (phase 1). Source of truth for: SQL seed (gen-sql.js) + screenshot map (regen.js).
// shot: [page, params, cssSelector, textContains, role]   role: owner (default) | pa
const C = (key, order, en, bm, ien, ibm, lessons, page) => ({ key, order, en, bm, ien, ibm, lessons, page });
const L = (slug, en, bm, ien, ibm, steps) => ({ slug, en, bm, ien, ibm, steps });
const S = (en, bm, o) => Object.assign({ en, bm }, o || {});
module.exports = [
C('sd_client', 15, 'Service Desk (My Services)', 'Service Desk (Servis Saya)',
 'My Services is where your company sends work to the M-Core team under your service contract. Each request is tracked with its own SLA clock, status and files, and every month you get a report pack.',
 'Servis Saya ialah tempat syarikat anda hantar kerja kepada pasukan M-Core di bawah kontrak servis. Setiap permohonan dijejak dengan jam SLA, status dan fail sendiri, dan setiap bulan anda terima pek laporan.', [
 L('my-services', 'My Services: contract, quota & requests', 'Servis Saya: kontrak, kuota & permohonan',
  'Read the contract card and request list first: they tell you how much quota is left and which requests need you.',
  'Baca kad kontrak dan senarai permohonan dahulu: ia beritahu baki kuota dan permohonan mana yang perlukan anda.', [
  S('The Service Contract card shows your contract period, SLA (business hours, Mon–Fri) and the monthly quota bar, e.g. 5 / 20 used this month.', 'Kad Kontrak Servis tunjuk tempoh kontrak, SLA (jam bekerja, Isnin–Jumaat) dan bar kuota bulanan, cth 5 / 20 digunakan bulan ini.',
   { n: ['Each request uses 1 quota when it is submitted; cancelled requests do not count.', 'Setiap permohonan guna 1 kuota bila dihantar; permohonan dibatalkan tidak dikira.'], t: 'servis_saya', shot: ['servis_saya', {}, '.cob-card', 'SERVICE CONTRACT'] }),
  S('The counters (In progress, Waiting, Delivered, Closed) and chips (All, Needs action, Delivered) filter the list. "Needs action" means M-Core is waiting on you or work was delivered for your check.', 'Kaunter (Proses, Tunggu, Dihantar, Ditutup) dan cip (Semua, Perlu tindakan, Dihantar) menapis senarai. "Perlu tindakan" bermaksud M-Core menunggu anda atau kerja sudah dihantar untuk semakan anda.',
   { t: 'servis_saya', shot: ['servis_saya', {}, '.cob-chip', 'Needs action'] }),
  S('Tap a request to open its timeline: status changes, messages, files and the SLA clock. When work is Delivered, accept it (Close) or ask for a Revision.', 'Tekan satu permohonan untuk buka garis masa: perubahan status, mesej, fail dan jam SLA. Bila kerja Dihantar, terima (Tutup) atau minta Revisi.',
   { n: ['Delivered requests close automatically 7 days after delivery.', 'Permohonan Dihantar ditutup automatik 7 hari selepas dihantar.'], t: 'servis_saya', shot: ['servis_saya', {}, '.sd-li', 'SR-'] }),
  S('Use the New request button to send work. Only services in your contract are listed.', 'Guna butang Permohonan baharu untuk hantar kerja. Hanya servis dalam kontrak anda disenaraikan.',
   { t: 'servis_saya', shot: ['servis_saya', {}, '#sd-fab', 'New request'] })]),
 L('multi-request', 'New request: one or many services', 'Permohonan baharu: satu atau banyak servis',
  'You can send up to 5 services in one go. Two or more services become a group (SG-…) with one request (SR-…) per service; one service stays a normal request.',
  'Anda boleh hantar sehingga 5 servis sekali gus. Dua atau lebih servis jadi satu kumpulan (SG-…) dengan satu permohonan (SR-…) setiap servis; satu servis kekal permohonan biasa.', [
  S('Step 1: tick the services you need (max 5). If a service already has an open request, choose "Add to existing SR" to add a note there instead of opening a duplicate.', 'Langkah 1: tanda servis yang perlu (maks 5). Jika servis itu sudah ada permohonan terbuka, pilih "Tambah ke SR sedia ada" untuk tambah nota di situ dan elak pendua.',
   { n: ['If the monthly quota cannot cover every service, the last ones are skipped with a warning; the others are still sent.', 'Jika kuota bulanan tidak cukup untuk semua servis, yang terakhir diskip dengan amaran; yang lain tetap dihantar.'], t: 'servis_saya', shot: ['servis_saya', { new: 1 }, '.sd-pick', ''] }),
  S('Step 2: fill in the title, details and priority. "Use same details for all" copies them to every service; switch it off to write per service. Shared attachments are linked to every request.', 'Langkah 2: isi tajuk, butiran dan keutamaan. "Guna butiran sama untuk semua" menyalin ke setiap servis; matikan untuk tulis setiap servis. Lampiran berkongsi dipaut ke setiap permohonan.',
   { t: 'servis_saya', shot: ['servis_saya', { new: 1, _step: 2 }, '.form-group', 'Title'] }),
  S('Step 3: review the list, warnings and SLA, tick "Save as template" if you send this combo often, then Submit.', 'Langkah 3: semak senarai, amaran dan SLA, tanda "Simpan sebagai templat" jika kerap hantar kombinasi ini, kemudian Hantar.',
   { n: ['Your draft is saved automatically, so you can come back later and tap Resume.', 'Draf anda disimpan automatik, jadi anda boleh kembali kemudian dan tekan Sambung.'], t: 'servis_saya', shot: ['servis_saya', { new: 1, _step: 3 }, '#mg-next', ''] }),
  S('A group card shows progress such as 2/3 done. Open it to see each request, the group thread, cancel one request, or rate the whole group when everything is done.', 'Kad kumpulan tunjuk kemajuan seperti 2/3 siap. Buka untuk lihat setiap permohonan, thread kumpulan, batal satu permohonan, atau beri rating kumpulan bila semua siap.',
   { n: ['Edit services is locked once M-Core assigns a PIC.', 'Ubah servis dikunci sebaik M-Core tetapkan PIC.'], t: 'servis_saya', shot: ['servis_saya', {}, '.sd-li', 'Waiting on you'] })]),
 L('public-link', 'Public link: requests without login', 'Link awam: permohonan tanpa log masuk',
  'Owners and admins can share a link so customers or staff send requests without an account. Every public request waits for your approval.',
  'Owner dan admin boleh kongsi link supaya pelanggan atau staf hantar permohonan tanpa akaun. Setiap permohonan awam menunggu kelulusan anda.', [
  S('Open the Public link tab, switch the link on, choose which services are allowed and set the link quota per month and an optional expiry date.', 'Buka tab Link awam, hidupkan link, pilih servis yang dibenarkan dan tetapkan kuota link sebulan serta tarikh tamat (pilihan).',
   { t: 'servis_saya', shot: ['servis_saya', { tab: 'link' }, '.cob-card', 'Services allowed'] }),
  S('Copy the link or QR and share it. Senders can pick up to 5 services in one submission; one submission uses 1 link quota.', 'Salin link atau QR dan kongsi. Penghantar boleh pilih sehingga 5 servis dalam satu hantaran; satu hantaran guna 1 kuota link.',
   { t: 'servis_saya', shot: ['servis_saya', { tab: 'link' }, '.cob-card', 'Used this month'] }),
  S('New public requests appear under Needs action. Approve sends them to M-Core and uses your contract quota; Reject closes them.', 'Permohonan awam baharu muncul di bawah Perlu tindakan. Lulus hantar kepada M-Core dan guna kuota kontrak; Tolak menutupnya.',
   { t: 'servis_saya', shot: ['servis_saya', {}, '.cob-chip', 'Needs action'] })]),
 L('monthly-reports', 'Monthly report pack', 'Pek laporan bulanan',
  'Each month M-Core sends a report pack: service SLA, groups, sales, HR, accounts and operations in one page you can save as PDF.',
  'Setiap bulan M-Core hantar pek laporan: SLA servis, kumpulan, jualan, HR, akaun dan operasi dalam satu halaman yang boleh disimpan sebagai PDF.', [
  S('Pick the month at the top. Only months that M-Core has sent appear.', 'Pilih bulan di atas. Hanya bulan yang sudah dihantar M-Core dipaparkan.', { t: 'laporan_bulanan', shot: ['laporan_bulanan', {}, '#sd-m', ''] }),
  S('Service summary shows requests, delivered, on-time % and average completion in business hours.', 'Ringkasan servis tunjuk permohonan, dihantar, % tepat masa dan purata siap dalam jam bekerja.', { t: 'laporan_bulanan', shot: ['laporan_bulanan', {}, '#sd-r-sla', ''] }),
  S('Tap Download all (PDF) to print or save the whole pack.', 'Tekan Muat turun semua (PDF) untuk cetak atau simpan seluruh pek.', { t: 'laporan_bulanan', shot: ['laporan_bulanan', {}, '#sd-pdf', ''] })]),
 L('support-access', 'Support access consent', 'Kebenaran akses sokongan',
  'You decide when M-Core staff may enter your workspace to do contracted work, and every session is logged.',
  'Anda tentukan bila staf M-Core boleh masuk ruang kerja anda untuk buat kerja kontrak, dan setiap sesi direkod.', [
  S('Switch on "Allow support access" and choose the scope: only for an open request, or the whole contract period.', 'Hidupkan "Benarkan akses sokongan" dan pilih skop: hanya untuk permohonan terbuka, atau sepanjang tempoh kontrak.', { t: 'sd_access', shot: ['sd_access', {}, '.cob-card', 'Scope'] }),
  S('Tick the modules staff may open (for example Sales, Accounting, HR & Payroll, Customers) and Save.', 'Tanda modul yang staf boleh buka (cth Jualan, Akaun, HR & Gaji, Pelanggan) dan Simpan.', { t: 'sd_access', shot: ['sd_access', {}, '.cob-card', 'Modules staff may open'] }),
  S('The Access log lists every session start and end with the request number and staff name.', 'Log akses senaraikan setiap mula dan tamat sesi dengan nombor permohonan dan nama staf.', { t: 'sd_access', shot: ['sd_access', {}, '.cob-card', 'Access log'] })])], 'servis_saya'),
C('sd_admin', 16, 'Service Desk Admin (M-Core team)', 'Admin Service Desk (pasukan M-Core)',
 'For platform admins: run every client request from one desk and manage service contracts.',
 'Untuk admin platform: urus setiap permohonan klien dari satu desk dan urus kontrak servis.', [
 L('desk', 'Service Desk board', 'Papan Service Desk',
  'The desk shows all open client requests sorted by SLA, with groups for multi-service requests.',
  'Desk tunjuk semua permohonan klien terbuka disusun ikut SLA, dengan kumpulan untuk permohonan berbilang servis.', [
  S('KPI cards show open requests, SLA breached, near SLA, waiting on client and average completion.', 'Kad KPI tunjuk permohonan terbuka, melepasi SLA, hampir SLA, tunggu klien dan purata siap.', { t: 'admin', shot: ['admin', { view: 'sd_desk' }, '.sd-kpis', '', 'pa'] }),
  S('Switch Group / Flat. In Group view, open a group to assign one PIC to all requests, then change PIC per request if needed.', 'Tukar Kumpulan / Rata. Dalam paparan Kumpulan, buka kumpulan untuk tetapkan satu PIC kepada semua permohonan, kemudian tukar PIC setiap permohonan jika perlu.', { t: 'admin', shot: ['admin', { view: 'sd_desk' }, '.mg-seg', '', 'pa'] }),
  S('Use Accept, Need info, Deliver or Reject on each request; one request never blocks the others. Split / move takes a request out of a group.', 'Guna Terima, Perlu info, Hantar atau Tolak pada setiap permohonan; satu permohonan tidak menyekat yang lain. Pecah / pindah keluarkan permohonan dari kumpulan.', { t: 'admin', shot: ['admin', { view: 'sd_desk' }, '.sd-li', 'SR-', 'pa'] }),
  S('Export CSV downloads the visible list, including the group reference.', 'Eksport CSV muat turun senarai yang dipaparkan, termasuk rujukan kumpulan.', { t: 'admin', shot: ['admin', { view: 'sd_desk' }, '#sd-csv', '', 'pa'] })]),
 L('contracts', 'Service contracts', 'Kontrak servis',
  'A request can only be sent while the client has an active, paid contract.', 'Permohonan hanya boleh dihantar ketika klien ada kontrak aktif dan berbayar.', [
  S('The list shows each client, period, payment and status (Active, Draft, Expired).', 'Senarai tunjuk setiap klien, tempoh, bayaran dan status (Aktif, Draf, Tamat).', { t: 'admin', shot: ['admin', { view: 'sd_contracts' }, '.cob-chips', '', 'pa'] }),
  S('Open a contract to set dates, invoice ref, payment status, services, monthly quota and SLA hours.', 'Buka kontrak untuk tetapkan tarikh, rujukan invois, status bayaran, servis, kuota bulanan dan jam SLA.', { t: 'admin', shot: ['admin', { view: 'sd_contracts' }, '.cob-card', 'Contract details', 'pa'] })])], 'admin'),
C('onboarding', 17, 'Onboarding Checklist', 'Senarai Semak Onboarding',
 'The onboarding checklist collects the documents and details M-Core needs to set up your company, with a target date and reminders.',
 'Senarai semak onboarding kumpul dokumen dan maklumat yang M-Core perlukan untuk sediakan syarikat anda, dengan tarikh sasaran dan peringatan.', [
 L('checklist', 'Completing your onboarding', 'Melengkapkan onboarding anda',
  'Work through the MAIN items first; they block go-live.', 'Selesaikan item MAIN dahulu; ia menghalang go-live.', [
  S('The banner shows how many MAIN items are incomplete, the target date and the next action.', 'Banner tunjuk berapa item MAIN belum lengkap, tarikh sasaran dan tindakan seterusnya.', { t: 'client_onboarding', shot: ['client_onboarding', {}, '.cob-banner', ''] }),
  S('Each item (A1, A2…) shows its status: Not started, Submitted, Approved, Rejected or N/A. Open it to upload the file or fill the detail.', 'Setiap item (A1, A2…) tunjuk status: Belum mula, Dihantar, Diluluskan, Ditolak atau T/B. Buka untuk muat naik fail atau isi maklumat.', { n: ['Rejected items show the reason; fix and resubmit.', 'Item ditolak tunjuk sebab; betulkan dan hantar semula.'], t: 'client_onboarding', shot: ['client_onboarding', {}, '.cob-chips', ''] }),
  S('Export PDF gives a copy of the checklist for your records.', 'Eksport PDF beri salinan senarai semak untuk rekod anda.', { t: 'client_onboarding', shot: ['client_onboarding', {}, 'button', 'Export PDF'] })])], 'client_onboarding'),
C('planner', 18, 'Planner & Bookings', 'Perancang & Tempahan',
 'Planner keeps appointments, todos, reminders, follow-ups and events in one calendar for you and your team. Public bookings land here too.',
 'Perancang simpan janji temu, tugasan, peringatan, susulan dan acara dalam satu kalendar untuk anda dan pasukan. Tempahan awam juga masuk di sini.', [
 L('planner', 'Using the Planner', 'Menggunakan Perancang', 'Add activities and filter by type or assignee.', 'Tambah aktiviti dan tapis ikut jenis atau penerima tugas.', [
  S('Tap Add Activity and choose the type: Appointment, Todo, Reminder, Follow-up or Event.', 'Tekan Tambah Aktiviti dan pilih jenis: Janji temu, Tugasan, Peringatan, Susulan atau Acara.', { t: 'planner', shot: ['planner', {}, 'button', 'Add Activity'] }),
  S('Filter by Open / Done, type and assignee to see only what matters today.', 'Tapis ikut Buka / Selesai, jenis dan penerima tugas untuk lihat yang penting hari ini sahaja.', { t: 'planner', shot: ['planner', {}, 'select', ''] }),
  S('The month calendar shows each activity by colour; tap Today to jump back.', 'Kalendar bulan tunjuk setiap aktiviti ikut warna; tekan Hari ini untuk kembali.', { t: 'planner', shot: ['planner', {}, 'button', 'Today'] })]),
 L('bookings', 'Bookings', 'Tempahan', 'Customers can book a slot through your public booking page.', 'Pelanggan boleh tempah slot melalui halaman tempahan awam anda.', [
  S('Turn on Public booking in Settings and share the link.', 'Hidupkan Tempahan awam dalam Tetapan dan kongsi link.', { t: 'settings', shot: ['settings', {}, '*', 'Public booking'] }),
  S('New bookings appear in the Bookings section of the Dashboard and in the Planner.', 'Tempahan baharu muncul di bahagian Tempahan pada Papan Pemuka dan dalam Perancang.', { t: 'dashboard', shot: ['dashboard', {}, '#db-sec-booking', ''] })])], 'planner'),
C('projects', 19, 'Projects', 'Projek',
 'Projects organise tasks on a board with stages, so everyone sees what is in progress, in review and done.',
 'Projek susun tugasan di papan mengikut peringkat, supaya semua nampak apa yang sedang berjalan, dalam semakan dan selesai.', [
 L('board', 'Projects board & tasks', 'Papan projek & tugasan', 'Create a project, add tasks and move them across stages.', 'Cipta projek, tambah tugasan dan gerakkan merentasi peringkat.', [
  S('Use + to create a project. Projects can be grouped by tag (Administration, Finance, Clients…).', 'Guna + untuk cipta projek. Projek boleh dikumpul ikut tag (Pentadbiran, Kewangan, Klien…).', { t: 'projects', shot: ['projects', {}, 'button', '+'] }),
  S('Add tasks with + New Task or + Add task in a column (Backlog, In Progress, Review, Done).', 'Tambah tugasan dengan + Tugasan Baharu atau + Tambah tugasan dalam lajur (Backlog, Dalam Proses, Semakan, Selesai).', { t: 'projects', shot: ['projects', {}, 'button', 'New Task'] }),
  S('Switch views: Board, Matrix, Timeline, List, Files and Overview (totals, overdue and progress %).', 'Tukar paparan: Papan, Matriks, Garis Masa, Senarai, Fail dan Ringkasan (jumlah, lewat dan % kemajuan).', { t: 'projects', shot: ['projects', {}, '*', 'Timeline'] })])], 'projects'),
C('sales_plan', 20, 'Sales Plan', 'Pelan Jualan',
 'Sales Plans turn a campaign into targets: GMV target vs actual, weekly KPI, stock financing and milestones.',
 'Pelan Jualan tukar kempen kepada sasaran: sasaran GMV lawan sebenar, KPI mingguan, pembiayaan stok dan pencapaian.', [
 L('plans', 'Creating and tracking a plan', 'Cipta dan jejak pelan', 'Start from a template, import Excel or build a new plan.', 'Mula dari templat, import Excel atau bina pelan baharu.', [
  S('Use New plan, From template or Import Excel.', 'Guna Pelan baharu, Dari templat atau Import Excel.', { t: 'sales_plan', shot: ['sales_plan', {}, 'button', 'New plan'] }),
  S('The table shows each plan period, sales source (manual or auto from M-Core), GMV target, actual, progress and PIC.', 'Jadual tunjuk tempoh setiap pelan, sumber jualan (manual atau auto dari M-Core), sasaran GMV, sebenar, kemajuan dan PIC.', { n: ['"Auto from M-Core" reads your real invoices, so actual updates by itself.', '"Auto dari M-Core" baca invois sebenar, jadi nilai sebenar dikemas kini sendiri.'], t: 'sales_plan', shot: ['sales_plan', {}, 'table', ''] }),
  S('Filter with the chips: All, Active, Draft, Completed, Archived.', 'Tapis dengan cip: Semua, Aktif, Draf, Selesai, Diarkib.', { t: 'sales_plan', shot: ['sales_plan', {}, '*', 'Active 1'] })])], 'sales_plan'),
C('sales_commission', 21, 'Sales Commission & Achievements', 'Komisen Jualan & Pencapaian',
 'Commission rules calculate what each sales person earns; Achievements show the badges they unlock.',
 'Peraturan komisen kira pendapatan setiap jurujual; Pencapaian tunjuk lencana yang dibuka.', [
 L('rules', 'Commission rules, ledger & leaderboard', 'Peraturan komisen, lejar & papan pendahulu', 'Set rules once; the ledger fills from invoices.', 'Tetapkan peraturan sekali; lejar diisi dari invois.', [
  S('In Rules, choose sales person, channel, product, rule type (Flat, Tiered, Target, Bonus, Unit, Split) and rate.', 'Dalam Peraturan, pilih jurujual, saluran, produk, jenis peraturan (Rata, Berperingkat, Sasaran, Bonus, Unit, Pecahan) dan kadar.', { t: 'sales_commission', shot: ['sales_commission', {}, 'select', ''] }),
  S('"Pay when" decides if commission counts on invoice issued or only on invoice paid.', '"Bayar bila" tentukan sama ada komisen dikira semasa invois dikeluarkan atau hanya bila invois dibayar.', { t: 'sales_commission', shot: ['sales_commission', {}, '*', 'Pay when'] }),
  S('Ledger lists every commission line; Leaderboard ranks the team.', 'Lejar senaraikan setiap baris komisen; Papan pendahulu menyusun pasukan.', { t: 'sales_commission', shot: ['sales_commission', {}, '*', 'Leaderboard'] })]),
 L('achievements', 'Achievements', 'Pencapaian', 'Badges unlock automatically from sales results.', 'Lencana dibuka automatik dari keputusan jualan.', [
  S('Open the Achievements tab, pick a sales person and month or year, then Apply.', 'Buka tab Pencapaian, pilih jurujual dan bulan atau tahun, kemudian Guna.', { t: 'achievements', shot: ['achievements', {}, 'button', 'Apply'] }),
  S('Unlocked badges show the unlock date; use Print for a certificate-style list.', 'Lencana dibuka tunjuk tarikh dibuka; guna Cetak untuk senarai gaya sijil.', { t: 'achievements', shot: ['achievements', {}, 'button', 'Print'] })])], 'sales_commission'),
C('sales_academy', 22, 'Sales Academy', 'Akademi Jualan',
 'Sales Academy is a separate training area with its own missions and leaderboard. This chapter only points you there.',
 'Akademi Jualan ialah ruang latihan berasingan dengan misi dan papan pendahulu sendiri. Bab ini hanya menunjukkan jalannya.', [
 L('pointer', 'Where to train', 'Di mana berlatih', 'Open Sales Academy from the sidebar under Learning Center.', 'Buka Akademi Jualan dari bar sisi di bawah Pusat Pembelajaran.', [
  S('Overview shows prospects, conversations, proposal stage and signed clients against the team target.', 'Ringkasan tunjuk prospek, perbualan, peringkat cadangan dan klien ditandatangani berbanding sasaran pasukan.', { t: 'sales_academy', shot: ['sales_academy', {}, '*', 'Total prospects'] }),
  S('Use the 3-Day Challenge and Training tabs to practise; Leaderboard and Reports track results.', 'Guna tab Cabaran 3 Hari dan Latihan untuk berlatih; Papan pendahulu dan Laporan jejak keputusan.', { t: 'sales_academy', shot: ['sales_academy', {}, '*', '3-Day Challenge'] })])], 'sales_academy'),
C('shifts', 23, 'Shifts', 'Syif',
 'Shifts plan who works when each week. It is a schedule only and is not posted to payroll.',
 'Syif rancang siapa bekerja bila setiap minggu. Ia jadual sahaja dan tidak dihantar ke gaji.', [
 L('schedule', 'Weekly schedule', 'Jadual mingguan', 'Assign shifts per staff per day.', 'Tetapkan syif setiap staf setiap hari.', [
  S('Use ‹ Today › to move weeks. Tap + in a staff row to assign Morning, Afternoon, Night, Off or Leave.', 'Guna ‹ Hari ini › untuk tukar minggu. Tekan + pada baris staf untuk tetapkan Pagi, Petang, Malam, Cuti rehat atau Cuti.', { t: 'shifts', shot: ['shifts', {}, 'table', ''] }),
  S('Shift hours is a tenant setting: adjust Morning / Afternoon / Night times and Save hours.', 'Jam syif ialah tetapan tenant: ubah masa Pagi / Petang / Malam dan Simpan jam.', { t: 'shifts', shot: ['shifts', {}, '*', 'Shift hours'] }),
  S('Open slots, approved leave and swap requests are listed on the side; Scheduled hours totals the week.', 'Slot kosong, cuti diluluskan dan permintaan tukar disenaraikan di sisi; Jam dijadualkan jumlahkan minggu itu.', { t: 'shifts', shot: ['shifts', {}, '*', 'Swap requests'] })])], 'shifts'),
C('expense_claims', 24, 'Expense Claims', 'Tuntutan Perbelanjaan',
 'Staff submit expense claims with receipts; finance approves and posts them.', 'Staf hantar tuntutan perbelanjaan dengan resit; kewangan luluskan dan rekodkan.', [
 L('claims', 'Submitting a claim', 'Menghantar tuntutan', 'Every claim needs a date, amount, category and receipt.', 'Setiap tuntutan perlukan tarikh, jumlah, kategori dan resit.', [
  S('Tap New Claim and fill in the details with a receipt photo.', 'Tekan Tuntutan Baharu dan isi butiran dengan gambar resit.', { t: 'expense_claims', shot: ['expense_claims', {}, 'button', 'New Claim'] }),
  S('Filter by date range, week, month or year; Print gives a list for approval.', 'Tapis ikut julat tarikh, minggu, bulan atau tahun; Cetak beri senarai untuk kelulusan.', { t: 'expense_claims', shot: ['expense_claims', {}, 'button', 'Filter'] })])], 'expense_claims'),
C('core_nav', 25, 'Menu, Notifications & Activity', 'Menu, Pemberitahuan & Aktiviti',
 'Find any page fast, keep an eye on what needs you, and see what changed.', 'Cari mana-mana halaman dengan pantas, pantau apa yang perlukan anda, dan lihat apa yang berubah.', [
 L('sidebar', 'The sidebar menu', 'Menu bar sisi', 'The menu is grouped by area and remembers your favourites.', 'Menu dikumpul ikut bahagian dan ingat kegemaran anda.', [
  S('Type in Search menu (or press /) to jump to any page. On a laptop, G then a letter jumps too.', 'Taip dalam Cari menu (atau tekan /) untuk lompat ke mana-mana halaman. Di laptop, G kemudian satu huruf juga melompat.', { t: 'dashboard', shot: ['dashboard', {}, '.nv-top', ''] }),
  S('Pin pages you use daily; Recent shows the last pages you opened. Sections can be collapsed.', 'Pin halaman yang anda guna setiap hari; Terkini tunjuk halaman terakhir dibuka. Bahagian boleh dilipat.', { t: 'dashboard', shot: ['dashboard', {}, '*', 'RECENT'] }),
  S('+ New opens quick create actions (invoice, task, request, claim) that your role can use.', '+ Baru buka tindakan cipta pantas (invois, tugasan, permohonan, tuntutan) yang dibenarkan untuk peranan anda.', { t: 'dashboard', shot: ['dashboard', {}, '.nv-top', ''] }),
  S('Owners and admins can arrange the menu for staff (order and hide) under Admin > Arrange menu.', 'Owner dan admin boleh susun menu untuk staf (susunan dan sembunyi) di Admin > Susun menu.', { n: ['Hiding a page in the menu does not change permissions; Role Permissions does.', 'Sembunyi halaman dalam menu tidak ubah kebenaran; Kebenaran Peranan yang ubah.'], t: 'admin', shot: ['planner', {}, '*', 'Arrange menu'] })]),
 L('notifications', 'Notifications', 'Pemberitahuan', 'The bell collects approvals, assignments, overdue invoices and activity.', 'Loceng kumpul kelulusan, tugasan, invois tertunggak dan aktiviti.', [
  S('Use the tabs All, Unread, Action, For you, Activity, Pinned and Snooze.', 'Guna tab Semua, Belum baca, Tindakan, Untuk anda, Aktiviti, Disemat dan Tunda.', { t: 'notifikasi', shot: ['notifikasi', {}, '*', 'Unread'] }),
  S('Filter by module (Approvals, Service Desk, Assigned & @mention…) and period; notifications are kept 90 days.', 'Tapis ikut modul (Kelulusan, Service Desk, Ditugaskan & @mention…) dan tempoh; pemberitahuan disimpan 90 hari.', { t: 'notifikasi', shot: ['notifikasi', {}, '*', 'Module:'] }),
  S('Settings lets each user choose which notifications to receive.', 'Tetapan membolehkan setiap pengguna pilih pemberitahuan yang diterima.', { t: 'notifikasi', shot: ['notifikasi', {}, 'button', 'Settings'] })]),
 L('activity', 'Activity log', 'Log aktiviti', 'See recent changes across the company.', 'Lihat perubahan terkini dalam syarikat.', [
  S('Activity Log in the menu jumps to the activity section on the Dashboard: who did what, and when.', 'Log Aktiviti dalam menu lompat ke bahagian aktiviti pada Papan Pemuka: siapa buat apa, dan bila.', { t: 'dashboard', shot: ['dashboard', {}, '#db-sec-activity', ''] }),
  S('For a full audit trail, admins use Settings > Audit Log.', 'Untuk jejak audit penuh, admin guna Tetapan > Log Audit.', { t: 'settings', shot: ['settings', {}, '*', 'Audit Log'] })])], 'dashboard'),
C('settings', 26, 'Settings, Roles & Company Profile', 'Tetapan, Peranan & Profil Syarikat',
 'Settings holds your company identity, who can open which module, and document tools.', 'Tetapan simpan identiti syarikat, siapa boleh buka modul mana, dan alat dokumen.', [
 L('company', 'Company Profile', 'Profil Syarikat', 'These details print on invoices and documents.', 'Butiran ini dicetak pada invois dan dokumen.', [
  S('Upload your logo and payment QR; Scan SSM Certificate and Scan Bank Statement can fill fields for you.', 'Muat naik logo dan QR bayaran; Imbas Sijil SSM dan Imbas Penyata Bank boleh isi medan untuk anda.', { t: 'settings', shot: ['settings', {}, '*', 'Upload Logo'] }),
  S('Fill Company Information, Address, Contact, Banking, Tax and Invoicing, then save.', 'Isi Maklumat Syarikat, Alamat, Hubungan, Perbankan, Cukai dan Invois, kemudian simpan.', { n: ['Company Profile is visible to owners and admins only because it holds bank and tax details.', 'Profil Syarikat hanya untuk owner dan admin kerana ia ada butiran bank dan cukai.'], t: 'settings', shot: ['settings', {}, '*', 'Company Information'] })]),
 L('roles', 'Role Permissions', 'Kebenaran Peranan', 'Owner and admin always have full access; set modules for other roles.', 'Owner dan admin sentiasa ada akses penuh; tetapkan modul untuk peranan lain.', [
  S('Open Role Permissions, add a role (e.g. staff) and tick the modules it may open.', 'Buka Kebenaran Peranan, tambah peranan (cth staff) dan tanda modul yang boleh dibuka.', { t: 'settings', shot: ['settings', {}, '*', 'Role Permissions'] }),
  S('Learning Center only shows chapters for modules a role can open.', 'Pusat Pembelajaran hanya tunjuk bab untuk modul yang peranan itu boleh buka.', { t: 'learning' })]),
 L('documents', 'Documents & security', 'Dokumen & keselamatan', 'Generate documents and protect sensitive actions.', 'Jana dokumen dan lindungi tindakan sensitif.', [
  S('Doc Generator creates standard letters and documents from your company details.', 'Penjana Dokumen hasilkan surat dan dokumen standard dari butiran syarikat anda.', { t: 'settings', shot: ['settings', {}, '*', 'Doc Generator'] }),
  S('Security PIN protects sensitive actions; Data Backup exports your data; Welcome Tour replays the intro.', 'PIN Keselamatan lindungi tindakan sensitif; Sandaran Data eksport data anda; Tur Panduan ulang tayang pengenalan.', { t: 'settings', shot: ['settings', {}, '*', 'Security PIN'] })])], 'settings'),
// refresh lessons for existing chapters (new stable lessons appended)
C('register', 1, null, null, null, null, [
 L('getting-started', 'Getting Started checklist (2026)', 'Senarai Mula Bermula (2026)', 'The Dashboard checklist walks you through every module once.', 'Senarai semak di Papan Pemuka bawa anda melalui setiap modul sekali.', [
  S('Getting Started with M-Core lists each module to try; items tick themselves as you use them.', 'Mula Bermula dengan M-Core senaraikan setiap modul untuk dicuba; item ditanda sendiri bila anda gunakannya.', { t: 'dashboard', shot: ['dashboard', {}, '*', 'Getting Started'] }),
  S('Set up your security PIN early; it is one of the first items.', 'Tetapkan PIN keselamatan awal; ia antara item pertama.', { t: 'settings', shot: ['settings', {}, '*', 'Security PIN'] }),
  S('Missed the intro tour? Settings > Welcome Tour > Replay tour.', 'Terlepas tur pengenalan? Tetapan > Tur Panduan > Ulang Tayang Tur.', { t: 'settings', shot: ['settings', {}, '#stg-replay-tour', ''] })])]),
C('dashboard', 2, null, null, null, null, [
 L('period', 'Dashboard periods & sections (2026)', 'Tempoh & bahagian Papan Pemuka (2026)', 'Change the period and jump to sections.', 'Tukar tempoh dan lompat ke bahagian.', [
  S('Switch Day, Week, Month or Year, or pick a month; all cards follow the period.', 'Tukar Hari, Minggu, Bulan atau Tahun, atau pilih bulan; semua kad ikut tempoh.', { t: 'dashboard', shot: ['dashboard', {}, '*', 'Week'] }),
  S('Bookings, Activity and Attendance tracker are sections further down; the menu links jump straight to them.', 'Tempahan, Aktiviti dan Penjejak kehadiran ialah bahagian di bawah; pautan menu lompat terus ke situ.', { t: 'dashboard', shot: ['dashboard', {}, '#db-sec-activity', ''] })])]),
C('sales', 4, null, null, null, null, [
 L('tabs', 'Invoices, Quotations & Credit Notes tabs (2026)', 'Tab Invois, Sebut Harga & Nota Kredit (2026)', 'Sales opens on Invoices; the other documents are tabs.', 'Jualan dibuka pada Invois; dokumen lain ialah tab.', [
  S('Use the tabs Invoices, Quotations and Credit Notes; New Invoice is top right.', 'Guna tab Invois, Sebut Harga dan Nota Kredit; Invois Baharu di kanan atas.', { t: 'sales', shot: ['sales', {}, 'button', 'New Invoice'] }),
  S('+ New in the menu also creates an invoice from anywhere.', '+ Baru dalam menu juga cipta invois dari mana-mana.', { t: 'sales', shot: ['sales', {}, '*', 'Quotations'] })])])
];
