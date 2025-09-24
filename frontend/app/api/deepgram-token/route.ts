import { NextResponse } from "next/server";
import { createClient } from "@deepgram/sdk";

export async function GET() {
  try {
    // Check if API key exists
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      console.error("DEEPGRAM_API_KEY not found in environment variables");
      return NextResponse.json({ error: "Deepgram API key not configured" }, { status: 500 });
    }

    const dg = createClient(apiKey);
    const { result, error } = await dg.auth.grantToken();
    
    if (error) {
      console.error("Deepgram token error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    const access_token = result.access_token;
    return NextResponse.json({ token: access_token });
  } catch (error) {
    console.error("Deepgram token generation error:", error);
    return NextResponse.json({ error: "Failed to generate Deepgram token" }, { status: 500 });
  }
}
