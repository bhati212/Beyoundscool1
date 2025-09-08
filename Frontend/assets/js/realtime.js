// Shared realtime helpers for Host & Join.
// Requires: window.SUPABASE_URL, window.SUPABASE_ANON_KEY and the Supabase CDN.

(function(){
  const getUID = () => {
    try {
      let id = localStorage.getItem('beyondscool_uid');
      if (!id) {
        id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('beyondscool_uid', id);
      }
      return id;
    } catch { return Math.random().toString(36).slice(2); }
  };

  function ensureClient(){
    const url = window.SUPABASE_URL || (window.BSCONFIG && window.BSCONFIG.SUPABASE_URL);
    const key = window.SUPABASE_ANON_KEY || (window.BSCONFIG && window.BSCONFIG.SUPABASE_ANON_KEY);
    if (!url || !key) {
      throw new Error('Supabase URL/key missing. Set them in Frontend/assets/js/config.js');
    }
    const { createClient } = supabase;
    return createClient(url, key);
  }

  function openChannel(pin, me){
    const supa = ensureClient();
    const room = `quiz:${pin}`;
    const channel = supa.channel(room, {
      config: {
        broadcast: { ack: true },
        presence:  { key: me.uid }
      }
    });

    const api = {
      supa,
      channel,
      trackPresence: async () => channel.track({ uid: me.uid, nick: me.nick, role: me.role }),
      onPresence: (cb) => {
        channel.on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          // Flatten presence map → [{uid,nick,role}]
          const list = [];
          Object.values(state).forEach(arr => {
            arr.forEach(meta => list.push(meta));
          });
          cb(list);
        });
      },
      onEvent: (event, cb) => {
        channel.on('broadcast', { event }, ({ payload }) => cb(payload));
      },
      emit: async (event, payload) => {
        await channel.send({ type: 'broadcast', event, payload });
      },
      subscribe: async () => {
        const { status } = await channel.subscribe();
        if (status !== 'SUBSCRIBED') throw new Error('Subscribe failed');
      },
      unsubscribe: async () => { await channel.unsubscribe(); }
    };

    return api;
  }

  // expose
  window.BSRT = { getUID, openChannel };
})();

