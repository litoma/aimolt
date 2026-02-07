import { supabase } from "./src/supabase.ts";

async function testConnection() {
    console.log("--- Testing Supabase Connection (Deno) ---");

    const { data, error } = await supabase
        .from("conversations")
        .select("count", { count: "exact", head: true });

    if (error) {
        console.error("❌ Connection Failed:", error);
        Deno.exit(1);
    } else {
        console.log(`✅ Connection Successful! Found ${data} (or null) rows (count check).`);
        // Note: head: true returns count in count property, data is null
        // Let's try fetching one row to be sure.

        const { data: rows, error: readError } = await supabase
            .from("conversations")
            .select("id")
            .limit(1);

        if (readError) {
            console.error("❌ Read Failed:", readError);
        } else {
            console.log("✅ Read Successful! Row:", rows);
        }
    }
}

if (import.meta.main) {
    await testConnection();
}
