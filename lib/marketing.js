const API_KEY  = () => process.env.CONVERTKIT_API_KEY;
const BASE_URL = 'https://api.convertkit.com/v3';

async function subscribeToConvertKit({ email, name, tags = [] }) {
  if (!API_KEY()) return null;

  try {
    // Create/update subscriber directly — no form required
    const res = await fetch(`${BASE_URL}/subscribers`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key:    API_KEY(),
        email,
        first_name: name?.split(' ')[0] || ''
      })
    });

    if (!res.ok) {
      console.warn('ConvertKit subscribe warning:', await res.text());
      return null;
    }

    const result = await res.json();

    // Apply any initial tags
    for (const tagId of tags.filter(Boolean)) {
      await tagSubscriber({ email, tagId }).catch(() => {});
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
