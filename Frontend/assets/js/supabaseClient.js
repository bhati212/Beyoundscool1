// Frontend/assets/js/supabaseClient.js
// GET these from: Supabase → Project Settings → API
const SUPABASE_URL = "https://cxqpmeqjauzjepeqzbnr.supabase.co";        // e.g. https://xxxx.supabase.co
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cXBtZXFqYXV6amVwZXF6Ym5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxODc5NDYsImV4cCI6MjA3Mjc2Mzk0Nn0.8x1NpJ4UQ3w5rzEo1dkRLRC7-CRHFonzvOb3waxWpv8"; // long JWT starting with eyJ...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);