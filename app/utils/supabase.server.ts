import { createServerClient } from "@supabase/ssr";

export function createClient(request: Request, context: any) {
  const cookies = request.headers.get("Cookie") ?? "";
  
  return createServerClient(
    context.SUPABASE_URL,
    context.SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (key) => {
          const cookie = cookies
            .split(';')
            .find((c) => c.trim().startsWith(`${key}=`));
          if (!cookie) return null;
          return cookie.split('=')[1];
        },
        set: (key, value, options) => {
          return new Response(null, {
            headers: {
              "Set-Cookie": `${key}=${value}; Path=/; HttpOnly; SameSite=Lax`,
            },
          });
        },
        remove: (key, options) => {
          return new Response(null, {
            headers: {
              "Set-Cookie": `${key}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
            },
          });
        },
      },
    }
  );
}
