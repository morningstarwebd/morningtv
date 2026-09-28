// crates/sentinel/src/main.rs
// Entry point for MorningTV Stream Sentinel CLI tool

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    sentinel::run().await
}
