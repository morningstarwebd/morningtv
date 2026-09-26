// src/storage/mod.rs
// Storage module re-exports

pub mod db;
pub mod favorites;
pub mod history;

pub use db::Database;
pub use favorites::FavoritesRepository;
pub use history::HistoryRepository;
