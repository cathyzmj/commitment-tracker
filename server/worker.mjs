// Cloudflare Worker: serves the app (static files from dist/) and its server endpoints.
//   /api/ics     calendar feed relay            (server/ics.mjs)
//   /api/sync    sync between devices           (server/sync.mjs)
//   /api/widget  widget summary mailbox         (server/widget.mjs)
//   /api/apps    Notion application tracker     (server/apps.mjs; secret NOTION_TOKEN)
// Storage is the D1 database bound as DB (server/schema.sql).
import { handle as ics } from './ics.mjs';
import { handle as sync } from './sync.mjs';
import { handle as widget } from './widget.mjs';
import { handle as apps } from './apps.mjs';
import { d1Store } from './d1-store.mjs';

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    try {
      switch (pathname) {
        case '/api/ics': return await ics(req);
        case '/api/sync': return await sync(req, d1Store(env.DB, 'sync'));
        case '/api/widget': return await widget(req, d1Store(env.DB, 'widget'));
        case '/api/apps': return await apps(req, {
          syncStore: d1Store(env.DB, 'sync'),
          env: { NOTION_TOKEN: env.NOTION_TOKEN, NOTION_APPS_DATABASE: env.NOTION_APPS_DATABASE },
        });
      }
    } catch (e) {
      return Response.json({ error: 'Server error. Try again shortly.' }, { status: 500, headers: { 'cache-control': 'no-store' } });
    }
    if (pathname.startsWith('/api/')) return Response.json({ error: 'Not found' }, { status: 404 });
    return env.ASSETS.fetch(req);
  },
};
