// tests/filter_test.rs
// Automated tests for Channel search and category grouping

use app_lib::domain::Channel;
use app_lib::playlist::ChannelFilter;

#[test]
fn test_category_extraction_and_filtering() {
    let channels = vec![
        Channel::new("CNN".into(), None, "News".into(), "http://s1".into(), None, None),
        Channel::new("BBC".into(), None, "News".into(), "http://s2".into(), None, None),
        Channel::new("ESPN".into(), None, "Sports".into(), "http://s3".into(), None, None),
    ];

    let categories = ChannelFilter::extract_categories(&channels);
    assert!(categories.contains(&"All".to_string()));
    assert!(categories.contains(&"Favorites".to_string()));
    assert!(categories.contains(&"News".to_string()));
    assert!(categories.contains(&"Sports".to_string()));

    let news = ChannelFilter::filter_channels(&channels, "News", "");
    assert_eq!(news.len(), 2);

    let search = ChannelFilter::filter_channels(&channels, "All", "espn");
    assert_eq!(search.len(), 1);
    assert_eq!(search[0].name, "ESPN");
}

#[test]
fn test_composite_category_splitting() {
    let channels = vec![
        Channel::new(
            "Disney".into(),
            None,
            "Entertainment;Family;General".into(),
            "http://s1".into(),
            None,
            None,
        ),
        Channel::new(
            "Cartoon Network".into(),
            None,
            "Animation;Kids".into(),
            "http://s2".into(),
            None,
            None,
        ),
    ];

    let categories = ChannelFilter::extract_categories(&channels);
    assert!(categories.contains(&"Entertainment".to_string()));
    assert!(categories.contains(&"Family".to_string()));
    assert!(categories.contains(&"General".to_string()));
    assert!(categories.contains(&"Animation".to_string()));
    assert!(categories.contains(&"Kids".to_string()));
    assert!(!categories.contains(&"Entertainment;Family;General".to_string()));

    let entertainment = ChannelFilter::filter_channels(&channels, "Entertainment", "");
    assert_eq!(entertainment.len(), 1);
    assert_eq!(entertainment[0].name, "Disney");

    let animation = ChannelFilter::filter_channels(&channels, "Animation", "");
    assert_eq!(animation.len(), 1);
    assert_eq!(animation[0].name, "Cartoon Network");
}
