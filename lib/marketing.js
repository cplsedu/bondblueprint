const API_KEY  = () => process.env.CONVERTKIT_API_KEY;
const BASE_URL = 'https://api.convertkit.com/v3';

async function subscribeToConvertKit({ email, name, firstName, lastName, tags = [] }) {
  if (!API_KEY()) return null;

  const first = firstName || name?.split(' ')[0] || '';
  const last  = lastName  || name?.split(' ').slice(1).join(' ') || '';

  try {
    // Use tag subscribe endpoint — creates subscriber if they don't exist AND applies the tag.
    // PUT /v3/subscribers does NOT create new subscribers (returns 404), so we go via tags.
    let result = null;
    for (const tagId of tags.filter(Boolean)) {
      const res = await fetch(`${BASE_URL}/tags/${tagId}/subscribe`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key:    API_KEY(),
          email,
          first_name: first,
          fields:     { last_name: last }
        })
      });
      if (!res.ok) {
        console.warn('ConvertKit tag subscribe warning:', await res.text());
      } else {
        result = await res.json();
      }
    }
    return result;
  } catch (err) {
    console.warn('ConvertKit subscribe error (non-fatal):', err.message);
    return null;
  }
}

async function tagSubscriber({ email, tagId }) {
  if (!API_KEY() || !tagId) return null;

  try {
    const res = await fetch(`${BASE_URL}/tags/${tagId}/subscribe`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: API_KEY(), email })
    });

    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    console.warn('ConvertKit tag error (non-fatal):', err.message);
    return null;
  }
}

async function removeTag({ email, tagId }) {
  if (!API_KEY() || !tagId) return null;

  try {
    const res = await fetch(`${BASE_URL}/tags/${tagId}/unsubscribe`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: API_KEY(), email })
    });

    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    console.warn('ConvertKit remove tag error (non-fatal):', err.message);
    return null;
  }
}

module.exports = { subscribeToConvertKit, tagSubscriber, removeTag };
