/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: 'demo' | 'supabase';
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_BASE_PATH?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
interface ImportMetaEnv {
  readonly VITE_VIDEO_PAINEL_URL?: string;
  readonly VITE_VIDEO_HALL_URL?: string;
}
