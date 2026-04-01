use pdfiuh_ffi::{MuPdfContext, PdfDocument};
use crate::{PdfiuhError, Result};
use std::collections::{HashMap, VecDeque};

pub struct Image {
    pub data: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

impl Image {
    pub fn from_rgba(data: Vec<u8>, width: u32, height: u32) -> Self {
        Self { data, width, height }
    }
}

pub struct PageRenderer {
    _ctx: MuPdfContext,
    cache: HashMap<usize, Image>,
    lru_order: VecDeque<usize>, // Tracks the recent access sequence
    current_bytes: usize,       // Tracks live footprint
    max_bytes: usize,           // Absolute memory limit
}

impl PageRenderer {
    pub fn new(ctx: MuPdfContext) -> Self {
        Self {
            _ctx: ctx,
            cache: HashMap::new(),
            lru_order: VecDeque::new(),
            current_bytes: 0,
            max_bytes: 20 * 1024 * 1024, // 20 MB footprint boundary
        }
    }

    fn touch_page(&mut self, page_num: usize) {
        if let Some(pos) = self.lru_order.iter().position(|&x| x == page_num) {
            self.lru_order.remove(pos);
        }
        self.lru_order.push_back(page_num);
    }

    fn evict_if_needed(&mut self, needed_bytes: usize) {
        while self.current_bytes + needed_bytes > self.max_bytes && !self.lru_order.is_empty() {
            if let Some(victim) = self.lru_order.pop_front() {
                if let Some(img) = self.cache.remove(&victim) {
                    self.current_bytes -= img.data.len();
                }
            }
        }
    }

    pub fn render_page(
        &mut self,
        _doc: &PdfDocument,
        page_num: usize,
        zoom: f32,
    ) -> Result<&Image> {
        // Cache Hits: Elevate its LRU status
        if self.cache.contains_key(&page_num) {
            self.touch_page(page_num);
            return self.cache.get(&page_num).ok_or_else(|| PdfiuhError::RenderError("Failed to retrieve image from cache".into()));
        }

        // Cache Miss: Prepare allocation with visual scaling/capping
        let base_width: f32 = 595.0;  // Standard A4 width reference
        let base_height: f32 = 842.0;

        let mut target_width = (base_width * zoom) as u32;
        let mut target_height = (base_height * zoom) as u32;
        let mut estimated_bytes = (target_width * target_height * 4) as usize;

        // Capping resolution natively on the rasterizer 
        let single_page_limit = 15 * 1024 * 1024; // 15 MB boundary
        if estimated_bytes > single_page_limit {
            let scale_factor = ((single_page_limit as f32) / (estimated_bytes as f32)).sqrt();
            target_width = (target_width as f32 * scale_factor) as u32;
            target_height = (target_height as f32 * scale_factor) as u32;
            estimated_bytes = (target_width * target_height * 4) as usize;
        }

        // Defensive eviction targeting the configured memory boundary
        self.evict_if_needed(estimated_bytes);

        // Render via MuPDF mock
        // Instead of calling C FFI right now, we allocate a blank placeholder bitmap
        let mut pixmap = vec![255; estimated_bytes];
        
        // Mock watermark (safety validation marker of mock vs native)
        if !pixmap.is_empty() {
            for i in 0..(pixmap.len() / 50) {
                pixmap[i] = 120; // Some gray header indicating the page start
            }
        }

        let image = Image::from_rgba(pixmap, target_width, target_height);
        
        // Finalize state
        self.current_bytes += estimated_bytes;
        self.cache.insert(page_num, image);
        self.lru_order.push_back(page_num);

        self.cache.get(&page_num).ok_or_else(|| PdfiuhError::RenderError("Failed to cache image".into()))
    }
}
