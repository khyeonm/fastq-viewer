// AutoPipe Plugin: fastq-viewer
// FASTQ read viewer with quality score heatmap

(function() {
  var PAGE_SIZE = 50;
  var MAX_READS = 5000;
  var allReads = [];
  var filteredReads = [];
  var currentPage = 0;
  var filterText = '';
  var expandedIdx = {};
  var rootEl = null;

  function parse(text) {
    var lines = text.split('\n');
    var reads = [];
    var i = 0;
    while (i < lines.length && reads.length < MAX_READS) {
      var l1 = (lines[i] || '').trim();
      if (!l1 || l1[0] !== '@') { i++; continue; }
      var seq = (lines[i + 1] || '').trim();
      var qual = (lines[i + 3] || '').trim();
      if (seq) {
        reads.push({ header: l1.substring(1), seq: seq.toUpperCase(), qual: qual });
      }
      i += 4;
    }
    return reads;
  }

  function meanQual(qual) {
    if (!qual) return 0;
    var sum = 0;
    for (var i = 0; i < qual.length; i++) {
      sum += qual.charCodeAt(i) - 33;
    }
    return qual.length > 0 ? sum / qual.length : 0;
  }

  function qualColor(q) {
    if (q >= 30) return '#2e7d32';
    if (q >= 20) return '#e65100';
    return '#c62828';
  }

  function qualBadgeClass(q) {
    if (q >= 30) return 'q-good';
    if (q >= 20) return 'q-ok';
    return 'q-bad';
  }

  function computeStats(reads) {
    var totalBases = 0, q20 = 0, q30 = 0, totalQ = 0;
    var minLen = Infinity, maxLen = 0;
    for (var i = 0; i < reads.length; i++) {
      var len = reads[i].seq.length;
      totalBases += len;
      if (len < minLen) minLen = len;
      if (len > maxLen) maxLen = len;
      for (var j = 0; j < reads[i].qual.length; j++) {
        var q = reads[i].qual.charCodeAt(j) - 33;
        totalQ += q;
        if (q >= 20) q20++;
        if (q >= 30) q30++;
      }
    }
    if (reads.length === 0) minLen = 0;
    return {
      totalBases: totalBases,
      avgLen: reads.length > 0 ? Math.round(totalBases / reads.length) : 0,
      minLen: minLen, maxLen: maxLen,
      avgQ: totalBases > 0 ? (totalQ / totalBases).toFixed(1) : 0,
      q20pct: totalBases > 0 ? (q20 / totalBases * 100).toFixed(1) : 0,
      q30pct: totalBases > 0 ? (q30 / totalBases * 100).toFixed(1) : 0
    };
  }

  function formatNum(n) { return n.toLocaleString(); }

  function applyFilter() {
    var ft = filterText.toLowerCase();
    filteredReads = [];
    for (var i = 0; i < allReads.length; i++) {
      if (!ft || allReads[i].header.toLowerCase().indexOf(ft) >= 0) {
        filteredReads.push({ idx: i, data: allReads[i] });
      }
    }
    currentPage = 0;
  }

  function renderBases(seq, maxLen) {
    var s = seq.substring(0, maxLen || 300);
    var html = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      html += '<span class="base-' + ch + '">' + ch + '</span>';
    }
    if (seq.length > (maxLen || 300)) html += '<span style="color:#999">...</span>';
    return html;
  }

  function renderQualBar(qual, maxLen) {
    var q = qual.substring(0, maxLen || 300);
    var html = '';
    for (var i = 0; i < q.length; i++) {
      var score = q.charCodeAt(i) - 33;
      html += '<span class="qual-cell" style="background:' + qualColor(score) + '">' + '</span>';
    }
    return html;
  }

  function render() {
    if (!rootEl) return;
    var stats = computeStats(allReads);
    var totalPages = Math.max(1, Math.ceil(filteredReads.length / PAGE_SIZE));
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    var startIdx = currentPage * PAGE_SIZE;
    var pageReads = filteredReads.slice(startIdx, startIdx + PAGE_SIZE);

    var html = '<div class="fastq-plugin">';

    // Summary
    html += '<div class="fastq-summary">';
    html += '<span class="stat"><b>' + formatNum(allReads.length) + '</b> reads</span>';
    html += '<span class="stat"><b>' + formatNum(stats.totalBases) + '</b> total bases</span>';
    html += '<span class="stat">Length: <b>' + formatNum(stats.minLen) + ' - ' + formatNum(stats.maxLen) + '</b> (avg ' + formatNum(stats.avgLen) + ')</span>';
    html += '<span class="stat">Mean Q: <b>' + stats.avgQ + '</b></span>';
    var q20cls = parseFloat(stats.q20pct) >= 80 ? 'good' : 'warn';
    var q30cls = parseFloat(stats.q30pct) >= 70 ? 'good' : 'warn';
    html += '<span class="stat">Q20: <b class="' + q20cls + '">' + stats.q20pct + '%</b></span>';
    html += '<span class="stat">Q30: <b class="' + q30cls + '">' + stats.q30pct + '%</b></span>';
    if (allReads.length >= MAX_READS) {
      html += '<span class="stat" style="color:#c62828">(showing first ' + formatNum(MAX_READS) + ' reads)</span>';
    }
    html += '</div>';

    // Controls
    html += '<div class="fastq-controls">';
    html += '<input type="text" id="fastqFilter" placeholder="Search read headers..." value="' + filterText.replace(/"/g, '&quot;') + '">';
    html += '</div>';

    // Read list
    html += '<div class="fastq-list">';
    for (var ri = 0; ri < pageReads.length; ri++) {
      var entry = pageReads[ri];
      var read = entry.data;
      var gIdx = entry.idx;
      var mq = meanQual(read.qual);
      var isOpen = !!expandedIdx[gIdx];

      html += '<div class="fastq-entry">';
      html += '<div class="fastq-read-header" data-idx="' + gIdx + '">';
      html += '<span class="fastq-read-name">' + (isOpen ? '\u25BC ' : '\u25B6 ') + read.header + '</span>';
      html += '<span class="fastq-read-meta">';
      html += '<span>' + read.seq.length + ' bp</span>';
      html += '<span class="q-badge ' + qualBadgeClass(mq) + '">Q' + mq.toFixed(0) + '</span>';
      html += '</span>';
      html += '</div>';

      if (isOpen) {
        html += '<div class="fastq-detail">';
        html += '<div class="fastq-bases">' + renderBases(read.seq, 500) + '</div>';
        html += '<div class="fastq-qual-row">' + renderQualBar(read.qual, 500) + '</div>';
        html += '</div>';
      }
      html += '</div>';
    }
    html += '</div>';

    // Pagination
    if (totalPages > 1) {
      html += '<div class="fastq-pagination">';
      html += '<button data-page="prev">&laquo; Prev</button>';
      var startP = Math.max(0, currentPage - 3);
      var endP = Math.min(totalPages, startP + 7);
      if (startP > 0) html += '<button data-page="0">1</button><span>...</span>';
      for (var p = startP; p < endP; p++) {
        html += '<button data-page="' + p + '"' + (p === currentPage ? ' class="current"' : '') + '>' + (p + 1) + '</button>';
      }
      if (endP < totalPages) html += '<span>...</span><button data-page="' + (totalPages - 1) + '">' + totalPages + '</button>';
      html += '<button data-page="next">Next &raquo;</button>';
      html += '<span class="page-info">Page ' + (currentPage + 1) + ' of ' + totalPages + '</span>';
      html += '</div>';
    }

    html += '</div>';
    rootEl.innerHTML = html;

    // Events
    var fi = rootEl.querySelector('#fastqFilter');
    if (fi) fi.addEventListener('input', function() { filterText = this.value; applyFilter(); render(); });
    var hdrs = rootEl.querySelectorAll('.fastq-read-header');
    for (var i = 0; i < hdrs.length; i++) {
      hdrs[i].addEventListener('click', function() {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        expandedIdx[idx] = !expandedIdx[idx];
        render();
      });
    }
    var pbs = rootEl.querySelectorAll('.fastq-pagination button');
    for (var i = 0; i < pbs.length; i++) {
      pbs[i].addEventListener('click', function() {
        var pg = this.getAttribute('data-page');
        if (pg === 'prev') { if (currentPage > 0) currentPage--; }
        else if (pg === 'next') { var tp = Math.ceil(filteredReads.length / PAGE_SIZE); if (currentPage < tp - 1) currentPage++; }
        else { currentPage = parseInt(pg, 10); }
        render();
      });
    }
  }

  window.AutoPipePlugin = {
    render: function(container, fileUrl, filename) {
      rootEl = container;
      rootEl.innerHTML = '<div class="ap-loading">Loading...</div>';
      allReads = []; filteredReads = []; currentPage = 0; filterText = ''; expandedIdx = {};

      fetch(fileUrl)
        .then(function(resp) { return resp.text(); })
        .then(function(data) {
          allReads = parse(data);
          applyFilter();
          render();
        })
        .catch(function(err) {
          rootEl.innerHTML = '<p style="color:red;padding:16px;">Error loading file: ' + err.message + '</p>';
        });
    },
    destroy: function() { allReads = []; filteredReads = []; rootEl = null; }
  };
})();
