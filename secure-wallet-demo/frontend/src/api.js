const base = import.meta.env.VITE_API_BASE || '/api';
export async function api(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  const response = await fetch(`${base}${path}`, {
    ...rest,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) }
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}
