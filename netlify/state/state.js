exports.handler = async (event) => {
  const GIST_ID    = process.env.GIST_ID;
  const GIST_FILE  = process.env.GIST_FILE || 'codezilla-state.json';
  const GH_TOKEN   = process.env.GITHUB_TOKEN;
  const LEADER_PW  = process.env.LEADER_PASSWORD;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Leader-Password',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  /* GET — qualquer pessoa pode ler o estado */
  if (event.httpMethod === 'GET') {
    try {
      const r = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        headers: {
          'Authorization': `token ${GH_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });
      if (!r.ok) throw new Error('gist_fetch_failed');
      const data = await r.json();
      const content = data.files[GIST_FILE]?.content || '{}';
      const updatedAt = data.updated_at;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ state: JSON.parse(content), updatedAt }),
      };
    } catch (e) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  /* POST — só o líder pode escrever */
  if (event.httpMethod === 'POST') {
    const pw = event.headers['x-leader-password'];
    if (!pw || pw !== LEADER_PW) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'unauthorized' }) };
    }
    try {
      const body = JSON.parse(event.body || '{}');
      const r = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${GH_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          files: { [GIST_FILE]: { content: JSON.stringify(body.state, null, 2) } },
        }),
      });
      if (!r.ok) throw new Error('gist_save_failed');
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch (e) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'method_not_allowed' }) };
};
