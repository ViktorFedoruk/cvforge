// /js/supabase.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabase = createClient(
  'https://nltakrrcrgxwyirygqed.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sdGFrcnJjcmd4d3lpcnlncWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NjMyODcsImV4cCI6MjA4NDIzOTI4N30.NXWizTjQsF42srtImk7If3rXN3HqdnhNw8NMX2c3RVI'
);

window.supabase = supabase;
