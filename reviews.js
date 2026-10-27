/* VoltCE course reviews.
   - Anyone can read APPROVED reviews. No placeholder reviews are ever shown.
   - Only signed-in users who finished the course can post (enforced in the database, not just here).
   - Every review waits as "pending" until the owner approves it in Admin. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const titleOf = slug => { try { const c = COURSES.find(x => x.slug === slug); return c ? c.title : slug } catch (e) { return slug } };
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  let rating = 0;

  async function session() { try { const { data } = await supabaseClient.auth.getSession(); return data && data.session } catch (e) { return null } }

  async function loadList() {
    const el = $('rev-list'); if (!el) return;
    const { data, error } = await supabaseClient.from('reviews').select('id,created_at,course_slug,rating,body,display_name').eq('status', 'approved').order('created_at', { ascending: false }).limit(50);
    if (error) { el.innerHTML = '<div class="empty">Reviews could not be loaded right now.</div>'; return }
    if (!data.length) { el.innerHTML = '<div class="empty">No reviews yet. Reviews come only from people who finished a course.</div>'; return }
    const avg = data.reduce((a, r) => a + r.rating, 0) / data.length;
    el.innerHTML = `<div style="font-size:14px;margin-bottom:10px"><span style="color:#B8860B;letter-spacing:1px">${stars(Math.round(avg))}</span> <b>${avg.toFixed(1)}</b> from ${data.length} review${data.length === 1 ? '' : 's'}</div>` +
      data.map(r => `<div class="card-sm" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>${esc(r.display_name)}</b><span style="color:#B8860B;letter-spacing:1px" aria-label="${r.rating} out of 5 stars">${stars(r.rating)}</span></div>
        <div style="font-size:12px;color:var(--muted);margin:2px 0 8px">${esc(titleOf(r.course_slug))} · ${new Date(r.created_at).toLocaleDateString()}</div>
        <div style="font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(r.body)}</div></div>`).join('');
  }

  async function loadForm() {
    const wrap = $('rev-form'); if (!wrap) return;
    const s = await session();
    if (!s) { wrap.innerHTML = '<p class="page-sub" style="margin:0">Sign in and finish a course to leave a review. <button class="lnk" onclick="showPage(\'auth\')">Sign in</button></p>'; return }
    let slugs = [];
    try { slugs = COURSES.filter(c => !c.soon).map(c => c.slug) } catch (e) {}
    const done = [];
    for (const slug of slugs) { try { const { data } = await supabaseClient.rpc('has_completed', { slug }); if (data === true) done.push(slug) } catch (e) {} }
    if (!done.length) { wrap.innerHTML = '<p class="page-sub" style="margin:0">You can review a course after you finish it while signed in. Reviews are checked before they appear.</p>'; return }
    const { data: mine } = await supabaseClient.from('reviews').select('course_slug,status').eq('user_id', s.user.id);
    const have = {}; (mine || []).forEach(r => { have[r.course_slug] = r.status });
    const open = done.filter(sl => !have[sl]);
    if (!open.length) { wrap.innerHTML = '<p class="page-sub" style="margin:0">Thanks for your review. ' + (Object.values(have).includes('pending') ? 'It will appear after it is approved.' : '') + '</p>'; return }
    rating = 0;
    wrap.innerHTML = `<div class="card-sm"><b>Review a course you finished</b>
      <label class="form-label" for="rev-course" style="margin-top:10px">Course</label>
      <select class="form-select" id="rev-course">${open.map(sl => `<option value="${esc(sl)}">${esc(titleOf(sl))}</option>`).join('')}</select>
      <label class="form-label" style="margin-top:10px">Rating</label>
      <div id="rev-stars" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="rev-star" role="radio" aria-checked="false" aria-label="${n} star${n > 1 ? 's' : ''}" onclick="Reviews.rate(${n})">☆</button>`).join('')}</div>
      <label class="form-label" for="rev-name" style="margin-top:10px">Name shown with your review</label>
      <input class="form-input" id="rev-name" maxlength="40" placeholder="First name and last initial">
      <label class="form-label" for="rev-body" style="margin-top:10px">Your review</label>
      <textarea class="form-input" id="rev-body" rows="4" maxlength="1500" placeholder="What did you learn? Who is it for?"></textarea>
      <div id="rev-msg" style="font-size:13px;margin-top:8px"></div>
      <button class="btn-primary" style="max-width:220px;margin-top:10px" onclick="Reviews.submit()">Submit for approval</button>
      <p style="font-size:12px;color:var(--muted);margin-top:8px">Every review is read by the owner before it is shown.</p></div>`;
  }

  function rate(n) {
    rating = n;
    document.querySelectorAll('#rev-stars .rev-star').forEach((b, i) => { b.textContent = i < n ? '★' : '☆'; b.setAttribute('aria-checked', i + 1 === n ? 'true' : 'false') });
  }
  async function submit() {
    const msg = $('rev-msg'); msg.style.color = 'var(--red)';
    const slug = $('rev-course').value, name = $('rev-name').value.trim(), body = $('rev-body').value.trim();
    if (!rating) { msg.textContent = 'Choose a star rating.'; return }
    if (!name) { msg.textContent = 'Add the name to show.'; return }
    if (body.length < 10) { msg.textContent = 'Write at least a sentence (10 characters).'; return }
    const { error } = await supabaseClient.from('reviews').insert({ course_slug: slug, rating, body, display_name: name });
    if (error) { msg.textContent = /duplicate|unique/i.test(error.message) ? 'You already reviewed this course.' : (/row-level|policy/i.test(error.message) ? 'Only people who finished this course while signed in can review it.' : 'Could not save your review: ' + error.message); return }
    try { trk('review_submit', 'courses') } catch (e) {}
    $('rev-form').innerHTML = '<p class="page-sub" style="margin:0">Thank you. Your review will appear once it is approved.</p>';
  }

  /* Admin moderation (owner only; the database enforces it) */
  async function loadAdmin() {
    const el = $('admin-reviews-body'); if (!el) return; el.textContent = 'Loading…';
    const { data, error } = await supabaseClient.from('reviews').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) { el.textContent = 'Could not load: ' + error.message; return }
    if (!data.length) { el.textContent = 'No reviews yet.'; return }
    const order = { pending: 0, approved: 1, rejected: 2 };
    data.sort((a, b) => order[a.status] - order[b.status] || (a.created_at < b.created_at ? 1 : -1));
    el.innerHTML = `<div class="table-wrap"><table><thead><tr><th>When</th><th>Course</th><th>Who</th><th>Rating</th><th>Review</th><th>Status</th><th></th></tr></thead><tbody>${data.map(r => `<tr><td>${new Date(r.created_at).toLocaleDateString()}</td><td>${esc(titleOf(r.course_slug))}</td><td>${esc(r.display_name)}</td><td>${stars(r.rating)}</td><td style="white-space:pre-wrap;max-width:360px">${esc(r.body)}</td><td><span class="badge ${r.status === 'approved' ? 'badge-green' : r.status === 'pending' ? 'badge-amber' : 'badge-blue'}">${r.status}</span></td>
      <td style="white-space:nowrap"><button class="btn-sm" onclick="Reviews.setStatus(${r.id},'approved')">Approve</button> <button class="btn-sm" onclick="Reviews.setStatus(${r.id},'rejected')">Reject</button> <button class="btn-sm" onclick="Reviews.remove(${r.id})">Delete</button></td></tr>`).join('')}</tbody></table></div>`;
  }
  async function setStatus(id, status) { await supabaseClient.from('reviews').update({ status }).eq('id', id); loadAdmin() }
  async function remove(id) { if (!confirm('Delete this review for good?')) return; await supabaseClient.from('reviews').delete().eq('id', id); loadAdmin() }

  window.Reviews = { load() { loadList(); loadForm() }, rate, submit, loadAdmin, setStatus, remove };
})();
