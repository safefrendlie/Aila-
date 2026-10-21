// Agar APP_PASSCODE set hai to har API call par passcode check hota hai.
export function checkAuth(req) {
  const pass = process.env.APP_PASSCODE;
  if (!pass) return true;
  return req.headers.get('x-passcode') === pass;
}
