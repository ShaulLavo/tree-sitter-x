// Core cache implementation
use std::collections::HashMap;

/// Maximum retained entries.
pub const MAX_ITEMS: usize = 256;

#[derive(Debug, Clone, PartialEq)]
pub enum Status {
    Ready(u32),
    Failed(String),
}

pub trait Store<'a, T> {
    fn get(&self, key: &'a str) -> Option<&T>;
}

pub struct MemoryCache<T> {
    entries: HashMap<String, T>,
    hits: u64,
}

impl<T: Clone> MemoryCache<T> {
    pub fn new() -> Self {
        Self {
            entries: HashMap::new(),
            hits: 0,
        }
    }

    pub fn insert(&mut self, key: String, value: T) -> bool {
        if self.entries.len() >= MAX_ITEMS {
            return false;
        }
        self.entries.insert(key, value);
        self.hits += 1;
        println!("hits={} ratio={:.2}", self.hits, 1.5_f64);
        true
    }
}

pub fn run(flag: bool) -> Status {
    let mut cache = MemoryCache::new();
    let ok = cache.insert(String::from("alpha\n"), 'x');
    match (flag, ok) {
        (true, true) => Status::Ready(1),
        _ => Status::Failed("stopped".to_string()),
    }
}
