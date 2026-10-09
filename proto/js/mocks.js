/* Visual mocks of each service's web UI. In the real app these are the live websites, untouched. */

const lines = (n, cls = '') => Array.from({ length: n }, (_, i) => `<span class="ln ${cls}" style="width:${92 - i * 17}%"></span>`).join('');

const MOCKS = {
  facebook: () => `
    <div class="m fb">
      <div class="fb-top">
        <span class="fb-logo">f</span><span class="m-search">${icon('search', 14)} Search Facebook</span>
        <div class="fb-tabs"><span class="on">${icon('home', 20)}</span><span>${icon('users', 20)}</span><span>${icon('play', 20)}</span><span>${icon('msg', 20)}</span></div>
        <span class="fb-me">${av('You', 32)}</span>
      </div>
      <div class="fb-body">
        <aside class="fb-left">
          ${['You', 'Friends', 'Groups', 'Marketplace', 'Memories', 'Saved', 'Events'].map(t => `<div class="fb-nav">${av(t, 28)}<span>${t}</span></div>`).join('')}
        </aside>
        <main class="fb-feed">
          <div class="card fb-compose">${av('You', 36)}<span class="pill">What's on your mind?</span></div>
          <div class="fb-stories">${['Nadia Islam', 'Sara Khan', 'Arif Hossain', 'Rahim'].map((n, i) => `<div class="story" style="background:linear-gradient(160deg,${AV_COLORS[i]},${AV_COLORS[i + 3]})">${av(n, 30)}<b>${n.split(' ')[0]}</b></div>`).join('')}</div>
          ${[['Nadia Islam', 'Golden hour at Cox\'s Bazar 🌅', '#F59E0B,#EC4899'], ['Dhaka Photographers', 'Weekly theme: Street life. Share your best shot!', '#0EA5E9,#6366F1']].map(([n, t, g]) => `
            <div class="card fb-post">
              <div class="post-h">${av(n, 38)}<div><b>${n}</b><small>2h · 🌍</small></div></div>
              <p>${t}</p><div class="post-img" style="background:linear-gradient(135deg,${g})"></div>
              <div class="post-a"><span>👍 Like</span><span>💬 Comment</span><span>↗ Share</span></div>
            </div>`).join('')}
        </main>
        <aside class="fb-right"><h4>Contacts</h4>${['Sara Khan', 'Rahim', 'Arif Hossain', 'Nadia Islam', 'Mom'].map(n => `<div class="fb-nav">${av(n, 28)}<span>${n}</span><i class="online"></i></div>`).join('')}</aside>
      </div>
    </div>`,

  messenger: () => `
    <div class="m ms">
      <aside class="ms-list">
        <h3>Chats</h3><span class="m-search">${icon('search', 14)} Search Messenger</span>
        ${[['Sara Khan', 'Did you see the event page?', 1], ['Family chat', 'Mom: Dinner at 8', 1], ['Arif Hossain', 'Haha that video 😂'], ['Nadia Islam', 'You: See you there!']].map(([n, t, u], i) => `
          <div class="ms-row ${i === 0 ? 'on' : ''}">${av(n, 44)}<div><b class="${u ? 'unread' : ''}">${n}</b><small>${t} · ${i + 1}h</small></div>${u ? '<i class="blue-dot"></i>' : ''}</div>`).join('')}
      </aside>
      <main class="ms-thread">
        <div class="ms-head">${av('Sara Khan', 36)}<b>Sara Khan</b><span class="ms-ic">${icon('phone', 18)}${icon('video', 18)}</span></div>
        <div class="bubbles">
          <div class="b in">Hey! Are you joining the hike on Saturday?</div>
          <div class="b out">Yes! What time do we leave?</div>
          <div class="b in">7 AM sharp ⛰️</div>
          <div class="b in">Did you see the event page?</div>
        </div>
        <div class="composer"><span class="pill">Aa</span>${icon('send', 18)}</div>
      </main>
    </div>`,

  whatsapp: (inst) => `
    <div class="m wa">
      <aside class="wa-list">
        <div class="wa-top"><b>Chats</b><span>${icon('plus', 18)}${icon('more', 18)}</span></div>
        <span class="m-search">${icon('search', 14)} Search or start a new chat</span>
        <div class="wa-filters"><span class="on">All</span><span>Unread</span><span>Groups</span></div>
        ${[['Mom', 'Are you coming for dinner tonight?', 3, '9:41'], ['Rahim', 'Sent the photos from the trip 📸', 7, '9:37'], ['Uni Friends', 'Arif: Reunion next month?', 2, '9:12'], ['Nadia Islam', 'Okay 👍', 0, 'Yesterday'], ['Office Cricket', 'Match moved to Sunday', 0, 'Yesterday']].map(([n, t, u, tm], i) => `
          <div class="wa-row ${i === 0 ? 'on' : ''}">${av(n, 46)}<div class="wa-mid"><b>${n}</b><small>${t}</small></div><div class="wa-meta"><small class="${u ? 'g' : ''}">${tm}</small>${u ? `<i class="wa-count">${u}</i>` : ''}</div></div>`).join('')}
      </aside>
      ${STATE.call && STATE.call.inst === inst.id ? callScreen() : `
      <main class="wa-chat">
        <div class="wa-head">${av('Mom', 40)}<div><b>Mom</b><small>online</small></div><span class="wa-ic">${icon('video', 20)}${icon('phone', 18)}${icon('search', 18)}</span></div>
        <div class="wa-msgs">
          <div class="b in">Good morning! Did you eat breakfast? ☀️<small>8:02</small></div>
          <div class="b out">Yes Ma, had paratha 😄<small>8:15 ✓✓</small></div>
          <div class="b in">Your uncle is coming tonight<small>9:40</small></div>
          <div class="b in">Are you coming for dinner tonight?<small>9:41</small></div>
        </div>
        <div class="wa-compose">${icon('plus', 20)}<span class="pill">Type a message</span>${icon('mic', 20)}</div>
      </main>`}
    </div>`,

  instagram: () => `
    <div class="m ig">
      <aside class="ig-nav"><b class="ig-word">Instagram</b>
        ${[['home', 'Home'], ['search', 'Search'], ['compass', 'Explore'], ['play', 'Reels'], ['send', 'Messages'], ['heart', 'Notifications'], ['plus', 'Create']].map(([ic, t]) => `<div>${icon(ic, 22)}<span>${t}</span></div>`).join('')}
        <div>${av('You', 24)}<span>Profile</span></div>
      </aside>
      <main class="ig-feed">
        <div class="ig-stories">${['Your story', 'nadia.clicks', 'sara.k', 'arif_h', 'rahim.travels', 'dhaka.eats'].map(n => `<div class="ig-st"><span class="ring">${av(n, 56)}</span><small>${n}</small></div>`).join('')}</div>
        <div class="ig-post">
          <div class="post-h">${av('nadia.clicks', 32)}<b>nadia.clicks</b><small>· 3h</small></div>
          <div class="ig-img"></div>
          <div class="ig-act">${icon('heart', 22)}${icon('msg', 22)}${icon('send', 22)}<span class="sp"></span>${icon('pin', 22)}</div>
          <b>1,284 likes</b><p><b>nadia.clicks</b> Sunset never disappoints 🌅 #coxsbazar</p>
        </div>
      </main>
      <aside class="ig-side"><div class="post-h">${av('You', 44)}<div><b>you</b><small>Your Name</small></div></div><h5>Suggested for you</h5>
        ${['street.dhaka', 'bd.foodies', 'travel.bangla'].map(n => `<div class="post-h">${av(n, 32)}<div><b>${n}</b><small>Suggested for you</small></div><a>Follow</a></div>`).join('')}
      </aside>
    </div>`,

  linkedin: () => `
    <div class="m li">
      <div class="li-top"><span class="li-logo">in</span><span class="m-search">${icon('search', 14)} Search</span>
        <div class="li-nav">${[['home', 'Home'], ['users', 'My Network'], ['file', 'Jobs'], ['msg', 'Messaging'], ['bell', 'Notifications']].map(([ic, t], i) => `<span class="${i === 0 ? 'on' : ''}">${icon(ic, 20)}<small>${t}</small></span>`).join('')}</div>
      </div>
      <div class="li-body">
        <aside class="card li-me"><div class="li-banner"></div>${av('You', 64)}<b>Your Name</b><small>Software Engineer · Dhaka</small><hr><small>Profile viewers <b class="blue">48</b></small><small>Post impressions <b class="blue">1,203</b></small></aside>
        <main class="li-feed">
          <div class="card li-compose">${av('You', 44)}<span class="pill">Start a post</span></div>
          <div class="card li-post"><div class="post-h">${av('Emily Carter', 44)}<div><b>Emily Carter</b><small>VP Engineering · 1d</small></div></div>
            <p>We just shipped our biggest release of the year. Proud of this team! 🚀 We're hiring in Dhaka and remote.</p>
            <div class="post-img" style="background:linear-gradient(135deg,#0A66C2,#70B5F9);height:180px"></div>
            <div class="post-a"><span>👍 Like</span><span>💬 Comment</span><span>🔁 Repost</span><span>➤ Send</span></div></div>
        </main>
        <aside class="card li-news"><b>LinkedIn News</b>${['Tech hiring picks up in Q4', 'Remote work: 2026 trends', 'Startups in South Asia raise more'].map(t => `<div><b>• ${t}</b><small>2h ago · 1,024 readers</small></div>`).join('')}</aside>
      </div>
    </div>`,

  gmail: (inst) => {
    const work = inst.id.startsWith('w');
    const mails = work
      ? [['Emily Carter', 'Q4 roadmap review', 'Agenda attached, please review before…', 1], ['HR Team', 'Benefits enrollment', 'Open enrollment closes Friday…', 1], ['GitHub', '[extrovert] CI passed', 'All checks have passed on main…', 0], ['David Chen', 'Re: Design review', 'Looks great, a few comments…', 1]]
      : [['bKash', 'Payment received', 'You have received ৳ 2,500…', 1], ['Google', 'Security alert', 'New sign-in on Mac…', 1], ['Daraz', 'Your order shipped', 'Order #84213 is on the way…', 0], ['Nadia Islam', 'Photos!', 'Here are the photos from…', 1]];
    return `
    <div class="m gm">
      <div class="gm-top">${icon('menu', 20)}<b class="gm-word">Gmail</b><span class="m-search">${icon('search', 16)} Search mail</span>${av(work ? 'Work' : 'You', 32)}</div>
      <div class="gm-body">
        <aside class="gm-nav"><span class="gm-compose">✏️ Compose</span>${[['Inbox', inst.unread], ['Starred'], ['Snoozed'], ['Sent'], ['Drafts', 2]].map(([t, c], i) => `<div class="${i === 0 ? 'on' : ''}"><span>${t}</span>${c ? `<b>${c}</b>` : ''}</div>`).join('')}</aside>
        <main class="gm-list">${mails.map(([f, s, p, u], i) => `<div class="gm-row ${u ? 'unread' : ''}"><span class="gm-star">☆</span><b>${f}</b><span class="gm-sub"><b>${s}</b> - ${p}</span><small>9:${52 - i * 9} AM</small></div>`).join('')}</main>
      </div>
    </div>`;
  },

  calendar: () => `
    <div class="m gc">
      <div class="gm-top">${icon('menu', 20)}<b class="gm-word">Calendar</b><span class="pill sm">Today</span><b>October 2026</b></div>
      <div class="gc-grid">
        ${['Mon 5', 'Tue 6', 'Wed 7', 'Thu 8', 'Fri 9'].map((d, i) => `<div class="gc-col"><b class="${i === 4 ? 'today' : ''}">${d}</b>
          ${i % 2 === 0 ? '<span class="ev" style="top:30%;background:#4285F4">Standup · 10:00</span>' : ''}
          ${i === 1 || i === 4 ? '<span class="ev" style="top:55%;background:#0B8043">Design review · 14:00</span>' : ''}
          ${i === 3 ? '<span class="ev" style="top:42%;background:#F4511E">1:1 Emily · 12:00</span>' : ''}</div>`).join('')}
      </div>
    </div>`,

  drive: () => `
    <div class="m gd">
      <div class="gm-top">${icon('menu', 20)}<b class="gm-word">Drive</b><span class="m-search">${icon('search', 16)} Search in Drive</span></div>
      <div class="gd-grid">${['Brand kit', 'Reels — October', 'Invoices', 'Content calendar', 'Logo final.png', 'Pitch deck.pdf'].map((f, i) => `<div class="card gd-file"><div class="gd-thumb" style="background:${AV_COLORS[i]}22">${icon(i < 4 ? 'folder' : 'file', 28)}</div><b>${f}</b></div>`).join('')}</div>
    </div>`,

  meet: () => `
    <div class="m gmeet"><div class="gm-top"><b class="gm-word">Meet</b></div>
      <div class="gmeet-hero"><h2>Video calls and meetings for everyone</h2><p>Connect, collaborate and celebrate from anywhere.</p>
        <div><span class="btn primary">${icon('video', 16)} New meeting</span><span class="pill">Enter a code or link</span></div>
        ${STATE.sharing ? `<div class="gmeet-share">${icon('monitor', 18)} You are presenting to "Weekly sync"</div>` : ''}
      </div></div>`,

  chat: () => `
    <div class="m ms gchat">
      <aside class="ms-list"><h3>Chat</h3>${[['David Chen', 'Can you review my PR?', 1], ['Platform team', 'Emily: Ship it 🚀', 1], ['Design', 'New mocks uploaded']].map(([n, t, u]) => `<div class="ms-row">${av(n, 40)}<div><b class="${u ? 'unread' : ''}">${n}</b><small>${t}</small></div></div>`).join('')}</aside>
      <main class="ms-thread"><div class="ms-head">${av('David Chen', 36)}<b>David Chen</b></div>
        <div class="bubbles"><div class="b in">Deploy is green, merging now</div><div class="b in">Can you review my PR?</div><div class="b out g">On it 👍</div></div>
        <div class="composer"><span class="pill">Message David Chen</span>${icon('send', 18)}</div></main>
    </div>`,

  custom: (inst) => `
    <div class="m cu"><div class="cu-bar">${icon('globe', 14)} ${inst.url}</div>
      <div class="cu-body"><div class="card">${logo('custom', 48)}<h3>${inst.label}</h3><p>Any website you add by URL runs here, exactly like in a browser.</p>${lines(4)}</div></div></div>`,
};

function callScreen() {
  const c = STATE.call;
  return `<main class="call-screen">${av(c.with, 120)}<h2>${c.with}</h2><p class="call-timer" data-timer>00:00</p>
    <div class="call-btns"><span>${icon('mic', 22)}</span><span>${icon('video', 22)}</span><span class="end" data-act="end-call">${icon('phone', 22)}</span></div></main>`;
}

function renderMock(inst) {
  return MOCKS[inst.type](inst);
}
