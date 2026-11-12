use crate::errors::*;
use crate::models::*;
use near_sdk::require;

pub fn validate_slug(slug: &str) {
    let valid_length = (3..=32).contains(&slug.len());
    let valid_chars = slug
        .bytes()
        .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    require!(valid_length && valid_chars, INVALID_SLUG);
}

pub fn validate_name(name: &str, max_len: usize) {
    let length = name.trim().chars().count();
    require!(length >= 1 && length <= max_len, INVALID_NAME);
}

pub fn validate_mcc(mcc: u16) {
    require!((1..=9999).contains(&mcc), INVALID_MCC);
}

pub fn validate_color(color: &str) {
    let bytes = color.as_bytes();
    let valid =
        bytes.len() == 7 && bytes[0] == b'#' && bytes[1..].iter().all(u8::is_ascii_hexdigit);
    require!(valid, INVALID_COLOR);
}

pub fn validate_utc_offset(minutes: i16) {
    require!(
        (MIN_UTC_OFFSET_MINUTES..=MAX_UTC_OFFSET_MINUTES).contains(&minutes) && minutes % 15 == 0,
        INVALID_TIMEZONE
    );
}

pub fn validate_cashback_bps(bps: u16) {
    require!((1..=MAX_BPS).contains(&bps), INVALID_BPS);
}

pub fn validate_royalty_bps(bps: u16) {
    require!(bps <= MAX_BPS, INVALID_BPS);
}

pub fn validate_expiry_days(days: Option<u32>) {
    if let Some(days) = days {
        require!((1..=MAX_EXPIRY_DAYS).contains(&days), INVALID_EXPIRY);
    }
}

pub fn validate_tiers(tiers: &[Tier]) {
    require!(!tiers.is_empty() && tiers.len() <= MAX_TIERS, INVALID_TIERS);
    require!(tiers[0].min_purchases == 0, INVALID_TIERS);
    let increasing = tiers
        .windows(2)
        .all(|pair| pair[0].min_purchases < pair[1].min_purchases);
    require!(increasing, INVALID_TIERS);
    for tier in tiers {
        validate_name(&tier.name, 24);
        validate_perk(tier.perk.as_deref());
    }
}

pub fn validate_perk(perk: Option<&str>) {
    if let Some(perk) = perk {
        validate_name(perk, 80);
    }
}

pub fn validate_location(input: &LocationInput) {
    let valid_id = (1..=32).contains(&input.id.len())
        && input
            .id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    let valid_coordinates =
        (-90.0..=90.0).contains(&input.lat) && (-180.0..=180.0).contains(&input.lng);
    require!(valid_id && valid_coordinates, INVALID_LOCATION);
    validate_name(&input.name, 64);
    require!(input.address.chars().count() <= 160, INVALID_LOCATION);
}

pub fn validate_boost(input: &BoostInput) {
    validate_name(&input.name, 40);
    require!(
        (1..=MAX_BOOST_BPS).contains(&input.extra_bps),
        INVALID_BOOST
    );
    match input.schedule {
        BoostSchedule::Range { starts_ns, ends_ns } => require!(starts_ns < ends_ns, INVALID_BOOST),
        BoostSchedule::Weekly { weekday } => require!(weekday <= 6, INVALID_BOOST),
    }
}

pub fn validate_category(category: Option<&str>) {
    if let Some(category) = category {
        let length = category.chars().count();
        require!((1..=32).contains(&length), INVALID_CATEGORY);
    }
}
