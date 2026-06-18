module hello_celeris::hello_celeris;

use std::string::{Self, String};
use std::vector;
use sui::clock::{Self, Clock};
use sui::object::{Self, UID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};

const E_USERNAME_EMPTY: u64 = 2;
const E_USERNAME_TOO_LONG: u64 = 3;
const E_MAX_ENTRIES_REACHED: u64 = 4;

const MAX_GREETING_ENTRIES: u64 = 100;
const MAX_USERNAME_UTF8_BYTES: u64 = 32;
const HELLO_SUFFIX: vector<u8> = b" says Hello Celeris!";

public struct GreetingEntry has copy, drop, store {
    player_wallet: address,
    username: String,
    message: String,
    created_timestamp_ms: u64,
}

public struct AppState has key, store {
    id: UID,
    entry_count: u64,
    entries: vector<GreetingEntry>,
}

public entry fun initialize_app(ctx: &mut TxContext) {
    let app_state = create_app(ctx);

    transfer::share_object(app_state);
}

public entry fun say_hello(
    app_state: &mut AppState,
    clock: &Clock,
    username: String,
    ctx: &TxContext,
) {
    say_hello_impl(app_state, clock, username, ctx);
}

fun create_app(ctx: &mut TxContext): AppState {
    AppState {
        id: object::new(ctx),
        entry_count: 0,
        entries: vector[],
    }
}

fun say_hello_impl(
    app_state: &mut AppState,
    clock: &Clock,
    username: String,
    ctx: &TxContext,
) {
    let username_length = string::length(&username);
    assert!(username_length > 0, E_USERNAME_EMPTY);
    assert!(username_length <= MAX_USERNAME_UTF8_BYTES, E_USERNAME_TOO_LONG);
    assert!(app_state.entry_count < MAX_GREETING_ENTRIES, E_MAX_ENTRIES_REACHED);

    let message = render_message(copy username);
    let entry = GreetingEntry {
        player_wallet: tx_context::sender(ctx),
        username,
        message,
        created_timestamp_ms: clock::timestamp_ms(clock),
    };

    vector::push_back(&mut app_state.entries, entry);
    app_state.entry_count = app_state.entry_count + 1;
}

fun render_message(username: String): String {
    let mut message = username;
    string::append(&mut message, string::utf8(HELLO_SUFFIX));
    message
}

#[test_only]
fun destroy_for_testing(app_state: AppState, clock: Clock) {
    let AppState {
        id: app_state_id,
        entry_count: _,
        entries: _,
    } = app_state;

    object::delete(app_state_id);
    clock::destroy_for_testing(clock);
}

#[test]
fun initialize_app_creates_state() {
    let mut ctx = tx_context::new_from_hint(@0xA11CE, 7, 0, 0, 0);
    let app_state = create_app(&mut ctx);
    let clock = clock::create_for_testing(&mut ctx);

    assert!(app_state.entry_count == 0);
    assert!(vector::length(&app_state.entries) == 0);

    destroy_for_testing(app_state, clock);
}

#[test]
fun say_hello_records_sender_and_canonical_message() {
    let mut ctx = tx_context::new_from_hint(@0xB0B, 8, 0, 0, 0);
    let mut app_state = create_app(&mut ctx);
    let mut clock = clock::create_for_testing(&mut ctx);
    clock::set_for_testing(&mut clock, 4242);

    say_hello_impl(&mut app_state, &clock, string::utf8(b"Sam"), &ctx);

    let first_entry = vector::borrow(&app_state.entries, 0);
    assert!(first_entry.player_wallet == @0xB0B);
    assert!(string::into_bytes(copy first_entry.username) == b"Sam");
    assert!(string::into_bytes(copy first_entry.message) == b"Sam says Hello Celeris!");
    assert!(first_entry.created_timestamp_ms == 4242);
    assert!(app_state.entry_count == 1);

    destroy_for_testing(app_state, clock);
}

#[test, expected_failure(abort_code = E_MAX_ENTRIES_REACHED)]
fun say_hello_rejects_the_101st_greeting() {
    let mut ctx = tx_context::new_from_hint(@0xCAFE, 9, 0, 0, 0);
    let mut app_state = create_app(&mut ctx);
    let clock = clock::create_for_testing(&mut ctx);
    let mut i = 0;

    while (i < MAX_GREETING_ENTRIES) {
        say_hello_impl(&mut app_state, &clock, string::utf8(b"Sam"), &ctx);
        i = i + 1;
    };

    say_hello_impl(&mut app_state, &clock, string::utf8(b"Sam"), &ctx);

    destroy_for_testing(app_state, clock);
}
