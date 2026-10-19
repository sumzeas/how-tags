import "server-only";

// Word pools for generated handles (adjective-color-animal).
// 100 x 30 x 100 = 300,000 combinations. Keep words lowercase, ASCII,
// hyphen-free, and inoffensive in any combination.

export const ADJECTIVES = [
  "able", "agile", "artful", "ample", "bold", "brave", "bright", "brisk", "calm", "candid",
  "careful", "cheery", "civil", "clever", "cosmic", "cozy", "crisp", "curious", "daring", "dapper",
  "deft", "eager", "earnest", "easy", "epic", "fair", "fancy", "fearless", "festive", "fine",
  "fleet", "fluffy", "fond", "frank", "free", "fresh", "friendly", "frosty", "gentle", "giddy",
  "glad", "gleeful", "golden", "grand", "happy", "hardy", "hearty", "honest", "humble", "jolly",
  "jovial", "keen", "kind", "lively", "loyal", "lucky", "lunar", "merry", "mighty", "mellow",
  "modest", "neat", "nimble", "noble", "patient", "peppy", "plucky", "polite", "proud", "quick",
  "quiet", "rapid", "ready", "regal", "robust", "rustic", "serene", "sharp", "shiny", "sincere",
  "sleek", "smart", "snappy", "snug", "solar", "spry", "steady", "stellar", "sturdy", "sunny",
  "swift", "tidy", "tranquil", "trusty", "upbeat", "vivid", "warm", "wise", "witty", "zesty",
] as const;

export const COLORS = [
  "amber", "aqua", "azure", "beige", "blue", "bronze", "cobalt", "copper", "coral", "crimson",
  "cyan", "emerald", "gold", "green", "indigo", "ivory", "jade", "lavender", "lilac", "magenta",
  "maroon", "mint", "navy", "olive", "orange", "pink", "plum", "ruby", "silver", "teal",
] as const;

export const ANIMALS = [
  "alpaca", "badger", "bat", "beaver", "bison", "bobcat", "buffalo", "camel", "caribou", "cheetah",
  "chinchilla", "condor", "cougar", "coyote", "crane", "cricket", "deer", "dingo", "dolphin", "dove",
  "duck", "eagle", "egret", "elk", "falcon", "ferret", "finch", "flamingo", "fox", "frog",
  "gazelle", "gecko", "gerbil", "giraffe", "goose", "gopher", "gorilla", "hamster", "hare", "hawk",
  "hedgehog", "heron", "hippo", "ibis", "iguana", "impala", "jaguar", "jay", "kestrel", "kiwi",
  "koala", "lemur", "leopard", "lion", "llama", "lobster", "lynx", "macaw", "manatee", "marmot",
  "meerkat", "mole", "moose", "narwhal", "newt", "ocelot", "octopus", "orca", "osprey", "otter",
  "owl", "panda", "panther", "parrot", "pelican", "penguin", "puffin", "quail", "rabbit", "raccoon",
  "raven", "robin", "salmon", "seal", "sparrow", "squid", "squirrel", "starling", "stork", "swan",
  "tapir", "tiger", "toucan", "turtle", "walrus", "weasel", "whale", "wolf", "wombat", "yak",
] as const;
