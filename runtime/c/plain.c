/* Plain - the value runtime for C.
 *
 * C has no type that can hold anything, no lists that grow, no text that
 * joins, and no way to give memory back on its own. Plain needs all four, so
 * this file builds them.
 *
 * A Value is small and copied freely: a tag, a number, and a pointer to
 * something on the heap when it needs one. Everything on the heap is counted
 * - how many names are holding it - and swept up at the end of every loop
 * turn and when the program ends.
 *
 * Counting is not quite a garbage collector: a program that ties a knot in
 * itself (a list holding itself, two things pointing at each other) keeps
 * that knot until it stops. Everything else is freed.
 *
 * `plain translate x.plain --to c` writes this file out above your program,
 * so what you get is one .c file that any C compiler will build.
 */

#include <math.h>
#include <setjmp.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

/* ------------------------------------------------------------ the value */

enum {
    PLAIN_NOTHING = 0,
    PLAIN_BOOL,
    PLAIN_NUMBER,
    PLAIN_TEXT,
    PLAIN_LIST,
    PLAIN_THING,
    PLAIN_ACTION
};

typedef struct PlainObj PlainObj;

typedef struct {
    int kind;
    double number;   /* a number, or yes/no as 1 and 0 */
    PlainObj *obj;   /* text, list, thing or action */
} Value;

struct PlainObj {
    int refs;
    int kind;

    char *text;      /* text */
    size_t bytes;

    Value *items;    /* list */
    size_t count;
    size_t room;

    char *thing_kind; /* thing */
    char **names;
    Value *fields;
    size_t field_count;
    size_t field_room;

    Value (*doing)(Value *args, int count); /* action */
};

static void plain_fail(const char *shape, ...);

static void *plain_ask_for(size_t bytes) {
    void *block = malloc(bytes);
    if (!block) {
        fprintf(stderr, "out of memory\n");
        exit(1);
    }
    return block;
}

/* -------------------------------------------------- everything ever made
 *
 * Every object goes on one list when it is made. Nothing is ever freed the
 * moment it is let go of, because something halfway through a sum may still
 * be holding it; the sweep at the end of a loop turn does the freeing.
 */

static PlainObj **plain_pool = NULL;
static size_t plain_pool_count = 0;
static size_t plain_pool_room = 0;

static PlainObj *plain_make(int kind) {
    PlainObj *obj = (PlainObj *)plain_ask_for(sizeof(PlainObj));
    memset(obj, 0, sizeof(PlainObj));
    obj->kind = kind;
    obj->refs = 0;
    if (plain_pool_count == plain_pool_room) {
        plain_pool_room = plain_pool_room ? plain_pool_room * 2 : 64;
        plain_pool = (PlainObj **)realloc(plain_pool, plain_pool_room * sizeof(PlainObj *));
        if (!plain_pool) {
            fprintf(stderr, "out of memory\n");
            exit(1);
        }
    }
    plain_pool[plain_pool_count++] = obj;
    return obj;
}

static void plain_retain(Value value) {
    if (value.obj) value.obj->refs++;
}

static void plain_release(Value value) {
    if (value.obj) value.obj->refs--;
}

static void plain_let_go(PlainObj *obj) {
    size_t at;
    if (obj->text) free(obj->text);
    if (obj->items) {
        for (at = 0; at < obj->count; at++) {
            if (obj->items[at].obj) obj->items[at].obj->refs--;
        }
        free(obj->items);
    }
    if (obj->names) {
        for (at = 0; at < obj->field_count; at++) {
            free(obj->names[at]);
            if (obj->fields[at].obj) obj->fields[at].obj->refs--;
        }
        free(obj->names);
        free(obj->fields);
    }
    if (obj->thing_kind) free(obj->thing_kind);
    free(obj);
}

/* Every name a piece of the program is holding, so the sweep knows what is
 * still wanted. Taking the address of each one also keeps the compiler from
 * parking it in a register, which is what lets a caught problem leave the
 * values as they were. */
typedef struct {
    Value **slots;
    size_t count;
    size_t room;
    size_t mark;     /* where this frame's own objects start in the pool */
} PlainFrame;

static void plain_enter(PlainFrame *frame) {
    frame->slots = NULL;
    frame->count = 0;
    frame->room = 0;
    frame->mark = plain_pool_count;
}

static void plain_local(PlainFrame *frame, Value *slot) {
    if (frame->count == frame->room) {
        frame->room = frame->room ? frame->room * 2 : 8;
        frame->slots = (Value **)realloc(frame->slots, frame->room * sizeof(Value *));
        if (!frame->slots) {
            fprintf(stderr, "out of memory\n");
            exit(1);
        }
    }
    frame->slots[frame->count++] = slot;
}

/* What arrives in an action is held the same way anything else is. */
static void plain_param(PlainFrame *frame, Value *slot) {
    plain_local(frame, slot);
    plain_retain(*slot);
}

/* Only this frame's own objects are looked at, so a sum halfway through in
 * whoever called us is never touched. Repeated until nothing more falls
 * away, because letting go of a list also lets go of what was in it. */
static void plain_sweep(PlainFrame *frame) {
    int again = 1;
    while (again) {
        size_t at;
        size_t keep = frame->mark;
        again = 0;
        for (at = frame->mark; at < plain_pool_count; at++) {
            PlainObj *obj = plain_pool[at];
            if (obj->refs <= 0) {
                plain_let_go(obj);
                again = 1;
            } else {
                plain_pool[keep++] = obj;
            }
        }
        plain_pool_count = keep;
    }
}

static void plain_keep(Value *slot, Value value) {
    plain_retain(value);
    plain_release(*slot);
    *slot = value;
}

static Value plain_leave(PlainFrame *frame, Value result) {
    size_t at;
    plain_retain(result);
    for (at = 0; at < frame->count; at++) plain_release(*frame->slots[at]);
    if (frame->slots) free(frame->slots);
    frame->slots = NULL;
    frame->count = 0;
    plain_release(result);
    return result;
}

/* --------------------------------------------------------- making values */

static Value plain_nothing(void) {
    Value value;
    value.kind = PLAIN_NOTHING;
    value.number = 0;
    value.obj = NULL;
    return value;
}

static Value plain_bool(int yes) {
    Value value = plain_nothing();
    value.kind = PLAIN_BOOL;
    value.number = yes ? 1 : 0;
    return value;
}

static Value plain_number_value(double number) {
    Value value = plain_nothing();
    value.kind = PLAIN_NUMBER;
    value.number = number;
    return value;
}

static Value plain_text_len(const char *text, size_t bytes) {
    Value value = plain_nothing();
    PlainObj *obj = plain_make(PLAIN_TEXT);
    obj->text = (char *)plain_ask_for(bytes + 1);
    memcpy(obj->text, text, bytes);
    obj->text[bytes] = 0;
    obj->bytes = bytes;
    value.kind = PLAIN_TEXT;
    value.obj = obj;
    return value;
}

static Value plain_text_value(const char *text) {
    return plain_text_len(text, strlen(text));
}

static Value plain_list_value(void) {
    Value value = plain_nothing();
    value.kind = PLAIN_LIST;
    value.obj = plain_make(PLAIN_LIST);
    return value;
}

static void plain_push(Value list, Value item) {
    PlainObj *obj = list.obj;
    if (!obj || list.kind != PLAIN_LIST) return;
    if (obj->count == obj->room) {
        obj->room = obj->room ? obj->room * 2 : 8;
        obj->items = (Value *)realloc(obj->items, obj->room * sizeof(Value));
        if (!obj->items) {
            fprintf(stderr, "out of memory\n");
            exit(1);
        }
    }
    plain_retain(item);
    obj->items[obj->count++] = item;
}

static Value plain_list_of(int count, ...) {
    Value list = plain_list_value();
    va_list rest;
    int at;
    va_start(rest, count);
    for (at = 0; at < count; at++) plain_push(list, va_arg(rest, Value));
    va_end(rest);
    return list;
}

static Value plain_action_value(Value (*doing)(Value *args, int count)) {
    Value value = plain_nothing();
    value.kind = PLAIN_ACTION;
    value.obj = plain_make(PLAIN_ACTION);
    value.obj->doing = doing;
    return value;
}

/* --------------------------------------------------------------- things */

static long plain_field_at(Value thing, const char *name) {
    size_t at;
    if (thing.kind != PLAIN_THING || !thing.obj) return -1;
    for (at = 0; at < thing.obj->field_count; at++) {
#ifdef _WIN32
        if (_stricmp(thing.obj->names[at], name) == 0) return (long)at;
#else
        if (strcasecmp(thing.obj->names[at], name) == 0) return (long)at;
#endif
    }
    return -1;
}

static void plain_own(Value thing, const char *name, Value value) {
    PlainObj *obj = thing.obj;
    long found = plain_field_at(thing, name);
    if (!obj) return;
    if (found >= 0) {
        plain_retain(value);
        plain_release(obj->fields[found]);
        obj->fields[found] = value;
        return;
    }
    if (obj->field_count == obj->field_room) {
        obj->field_room = obj->field_room ? obj->field_room * 2 : 8;
        obj->names = (char **)realloc(obj->names, obj->field_room * sizeof(char *));
        obj->fields = (Value *)realloc(obj->fields, obj->field_room * sizeof(Value));
        if (!obj->names || !obj->fields) {
            fprintf(stderr, "out of memory\n");
            exit(1);
        }
    }
    obj->names[obj->field_count] = (char *)plain_ask_for(strlen(name) + 1);
    strcpy(obj->names[obj->field_count], name);
    plain_retain(value);
    obj->fields[obj->field_count] = value;
    obj->field_count++;
}

static Value plain_thing_value(const char *kind) {
    Value value = plain_nothing();
    value.kind = PLAIN_THING;
    value.obj = plain_make(PLAIN_THING);
    value.obj->thing_kind = (char *)plain_ask_for(strlen(kind) + 1);
    strcpy(value.obj->thing_kind, kind);
    return value;
}

/* Written out with the program: what a kind starts with, what it is based
 * on, and what it knows how to do. */
static void plain_defaults(const char *kind, Value into);
static const char *plain_base(const char *kind);
static int plain_do(const char *kind, const char *action, Value me, Value *args, int count, Value *answer);

static Value plain_record(int count, ...) {
    Value thing = plain_thing_value("");
    va_list rest;
    int at;
    va_start(rest, count);
    for (at = 0; at < count; at++) {
        const char *name = va_arg(rest, const char *);
        plain_own(thing, name, va_arg(rest, Value));
    }
    va_end(rest);
    return thing;
}

static Value plain_new(const char *kind, int count, ...) {
    Value thing = plain_thing_value(kind);
    va_list rest;
    int at;
    plain_defaults(kind, thing);
    va_start(rest, count);
    for (at = 0; at < count; at++) {
        const char *name = va_arg(rest, const char *);
        plain_own(thing, name, va_arg(rest, Value));
    }
    va_end(rest);
    return thing;
}

/* ------------------------------------------------- when things go wrong */

typedef struct PlainCatch {
    jmp_buf jump;
    char words[512];
    struct PlainCatch *outer;
} PlainCatch;

/* On Windows, setjmp quietly asks the system to unwind the stack on the way
 * back, which needs unwind data for every frame in between and falls over
 * without it. Asking for no frame skips that, which is all Plain wants:
 * nothing here has anything to tidy up on the way out - the sweep does it. */
#if defined(_WIN32) && defined(__GNUC__)
#define PLAIN_SETJMP(buffer) _setjmp((buffer), NULL)
#else
#define PLAIN_SETJMP(buffer) setjmp(buffer)
#endif

static PlainCatch *plain_catching = NULL;

static void plain_push_catch(PlainCatch *spot) {
    spot->outer = plain_catching;
    spot->words[0] = 0;
    plain_catching = spot;
}

static void plain_pop_catch(void) {
    if (plain_catching) plain_catching = plain_catching->outer;
}

static void plain_fail(const char *shape, ...) {
    char words[512];
    va_list rest;
    va_start(rest, shape);
    vsnprintf(words, sizeof(words), shape, rest);
    va_end(rest);
    if (plain_catching) {
        PlainCatch *spot = plain_catching;
        strncpy(spot->words, words, sizeof(spot->words) - 1);
        spot->words[sizeof(spot->words) - 1] = 0;
        longjmp(spot->jump, 1);
    }
    fprintf(stderr, "%s\n", words);
    exit(1);
}

/* ------------------------------------------------------- text, in letters
 *
 * Text is kept as UTF-8, and counted in letters rather than bytes, so that
 * an accent is one letter here the way it is everywhere else in Plain.
 */

static size_t plain_utf8_count(const char *text, size_t bytes) {
    size_t at = 0, letters = 0;
    while (at < bytes) {
        unsigned char one = (unsigned char)text[at];
        at += one < 0x80 ? 1 : (one >> 5) == 6 ? 2 : (one >> 4) == 14 ? 3 : 4;
        letters++;
    }
    return letters;
}

static size_t plain_utf8_skip(const char *text, size_t bytes, size_t letters) {
    size_t at = 0, seen = 0;
    while (at < bytes && seen < letters) {
        unsigned char one = (unsigned char)text[at];
        at += one < 0x80 ? 1 : (one >> 5) == 6 ? 2 : (one >> 4) == 14 ? 3 : 4;
        seen++;
    }
    return at > bytes ? bytes : at;
}

/* --------------------------------------------------------------- writing */

static void plain_write(Value value, int depth, char **out, size_t *len, size_t *room);

static void plain_put(const char *text, size_t bytes, char **out, size_t *len, size_t *room) {
    if (*len + bytes + 1 > *room) {
        while (*len + bytes + 1 > *room) *room = *room ? *room * 2 : 64;
        *out = (char *)realloc(*out, *room);
        if (!*out) {
            fprintf(stderr, "out of memory\n");
            exit(1);
        }
    }
    memcpy(*out + *len, text, bytes);
    *len += bytes;
    (*out)[*len] = 0;
}

/* Numbers read the way Plain writes them: whole ones with no decimal point,
 * the rest to twelve figures, so 0.1 plus 0.2 is 0.3 and not a long tail. */
static void plain_number_text(double number, char *into, size_t room) {
    if (number != number) {
        snprintf(into, room, "not a number");
    } else if (number > 1.7976931348623157e308) {
        snprintf(into, room, "infinity");
    } else if (number < -1.7976931348623157e308) {
        snprintf(into, room, "-infinity");
    } else if (number == floor(number) && fabs(number) < 1e18) {
        snprintf(into, room, "%.0f", number == 0 ? 0.0 : number);
    } else {
        snprintf(into, room, "%.12g", number);
    }
}

static void plain_write(Value value, int depth, char **out, size_t *len, size_t *room) {
    char buffer[64];
    size_t at;
    switch (value.kind) {
    case PLAIN_NOTHING:
        plain_put("nothing", 7, out, len, room);
        return;
    case PLAIN_BOOL:
        if (value.number) plain_put("yes", 3, out, len, room);
        else plain_put("no", 2, out, len, room);
        return;
    case PLAIN_NUMBER:
        plain_number_text(value.number, buffer, sizeof(buffer));
        plain_put(buffer, strlen(buffer), out, len, room);
        return;
    case PLAIN_TEXT:
        if (depth > 0) plain_put("\"", 1, out, len, room);
        plain_put(value.obj->text, value.obj->bytes, out, len, room);
        if (depth > 0) plain_put("\"", 1, out, len, room);
        return;
    case PLAIN_LIST:
        plain_put("[", 1, out, len, room);
        for (at = 0; at < value.obj->count; at++) {
            if (at) plain_put(", ", 2, out, len, room);
            plain_write(value.obj->items[at], depth + 1, out, len, room);
        }
        plain_put("]", 1, out, len, room);
        return;
    case PLAIN_THING: {
        int named = value.obj->thing_kind && value.obj->thing_kind[0];
        if (named) {
            plain_put("a ", 2, out, len, room);
            plain_put(value.obj->thing_kind, strlen(value.obj->thing_kind), out, len, room);
            plain_put(" (", 2, out, len, room);
        } else {
            plain_put("{", 1, out, len, room);
        }
        for (at = 0; at < value.obj->field_count; at++) {
            if (at) plain_put(", ", 2, out, len, room);
            plain_put(value.obj->names[at], strlen(value.obj->names[at]), out, len, room);
            plain_put(": ", 2, out, len, room);
            plain_write(value.obj->fields[at], depth + 1, out, len, room);
        }
        plain_put(named ? ")" : "}", 1, out, len, room);
        return;
    }
    default:
        plain_put("<action>", 8, out, len, room);
    }
}

/* The caller frees what comes back. */
static char *plain_show(Value value) {
    char *out = NULL;
    size_t len = 0, room = 0;
    plain_put("", 0, &out, &len, &room);
    plain_write(value, 0, &out, &len, &room);
    return out;
}

static Value plain_text(Value value) {
    char *said = plain_show(value);
    Value out = plain_text_value(said);
    free(said);
    return out;
}

static void plain_say(Value value) {
    char *said = plain_show(value);
    printf("%s\n", said);
    free(said);
}

/* ---------------------------------------------------------- reading back */

static double plain_number(Value value) {
    switch (value.kind) {
    case PLAIN_NUMBER:
    case PLAIN_BOOL:
        return value.number;
    case PLAIN_TEXT: {
        char *stopped = NULL;
        double found = strtod(value.obj->text, &stopped);
        if (stopped == value.obj->text) return 0;
        while (*stopped == ' ' || *stopped == '\t' || *stopped == '\n' || *stopped == '\r') stopped++;
        return *stopped ? 0 : found;
    }
    default:
        return 0;
    }
}

static long long plain_whole(Value value) {
    return (long long)plain_number(value);
}

static int plain_truthy(Value value) {
    switch (value.kind) {
    case PLAIN_NOTHING: return 0;
    case PLAIN_BOOL:
    case PLAIN_NUMBER: return value.number != 0;
    case PLAIN_TEXT: return value.obj->bytes > 0;
    case PLAIN_LIST: return value.obj->count > 0;
    default: return 1;
    }
}

static int plain_alike(Value a, Value b) {
    size_t at;
    if (a.kind == PLAIN_NOTHING || b.kind == PLAIN_NOTHING) {
        return a.kind == PLAIN_NOTHING && b.kind == PLAIN_NOTHING;
    }
    if (a.kind == PLAIN_BOOL || b.kind == PLAIN_BOOL) {
        return plain_truthy(a) == plain_truthy(b);
    }
    if (a.kind == PLAIN_NUMBER || b.kind == PLAIN_NUMBER) {
        return plain_number(a) == plain_number(b);
    }
    if (a.kind == PLAIN_TEXT && b.kind == PLAIN_TEXT) {
        return a.obj->bytes == b.obj->bytes && memcmp(a.obj->text, b.obj->text, a.obj->bytes) == 0;
    }
    if (a.kind == PLAIN_LIST && b.kind == PLAIN_LIST) {
        if (a.obj->count != b.obj->count) return 0;
        for (at = 0; at < a.obj->count; at++) {
            if (!plain_alike(a.obj->items[at], b.obj->items[at])) return 0;
        }
        return 1;
    }
    return a.obj == b.obj;
}

static Value plain_same(Value a, Value b) {
    return plain_bool(plain_alike(a, b));
}

/* ------------------------------------------------------------ arithmetic */

static Value plain_join2(Value a, Value b) {
    char *left = plain_show(a);
    char *right = plain_show(b);
    size_t one = strlen(left), other = strlen(right);
    char *both = (char *)plain_ask_for(one + other + 1);
    Value out;
    memcpy(both, left, one);
    memcpy(both + one, right, other);
    both[one + other] = 0;
    out = plain_text_len(both, one + other);
    free(both);
    free(left);
    free(right);
    return out;
}

static Value plain_add(Value a, Value b) {
    if (a.kind == PLAIN_TEXT || b.kind == PLAIN_TEXT) return plain_join2(a, b);
    return plain_number_value(plain_number(a) + plain_number(b));
}

static Value plain_minus(Value a, Value b) { return plain_number_value(plain_number(a) - plain_number(b)); }
static Value plain_times(Value a, Value b) { return plain_number_value(plain_number(a) * plain_number(b)); }

static Value plain_divide(Value a, Value b) {
    if (plain_number(b) == 0) plain_fail("I cannot divide by zero");
    return plain_number_value(plain_number(a) / plain_number(b));
}

static Value plain_remainder(Value a, Value b) {
    if (plain_number(b) == 0) plain_fail("I cannot divide by zero");
    return plain_number_value(fmod(plain_number(a), plain_number(b)));
}

static Value plain_power(Value a, Value b) { return plain_number_value(pow(plain_number(a), plain_number(b))); }
static Value plain_negate(Value a) { return plain_number_value(-plain_number(a)); }
static Value plain_less(Value a, Value b) { return plain_bool(plain_number(a) < plain_number(b)); }
static Value plain_less_equal(Value a, Value b) { return plain_bool(plain_number(a) <= plain_number(b)); }
static Value plain_more(Value a, Value b) { return plain_bool(plain_number(a) > plain_number(b)); }
static Value plain_more_equal(Value a, Value b) { return plain_bool(plain_number(a) >= plain_number(b)); }

static Value plain_bits(const char *which, Value a, Value b) {
    long long left = plain_whole(a), right = plain_whole(b), out;
    if (strcmp(which, "and") == 0) out = left & right;
    else if (strcmp(which, "or") == 0) out = left | right;
    else if (strcmp(which, "xor") == 0) out = left ^ right;
    else if (strcmp(which, "left") == 0) out = left << right;
    else out = left >> right;
    return plain_number_value((double)out);
}

static Value plain_bits_not(Value a) { return plain_number_value((double)(~plain_whole(a))); }

/* ---------------------------------------------------------------- lists */

/* Everything a "for each" can walk over. */
static Value plain_items(Value value) {
    Value out = plain_list_value();
    size_t at;
    switch (value.kind) {
    case PLAIN_LIST:
        for (at = 0; at < value.obj->count; at++) plain_push(out, value.obj->items[at]);
        return out;
    case PLAIN_TEXT: {
        size_t seen = 0, bytes = value.obj->bytes;
        while (seen < bytes) {
            size_t next = plain_utf8_skip(value.obj->text + seen, bytes - seen, 1);
            plain_push(out, plain_text_len(value.obj->text + seen, next));
            seen += next;
        }
        return out;
    }
    case PLAIN_THING:
        for (at = 0; at < value.obj->field_count; at++) {
            plain_push(out, plain_text_value(value.obj->names[at]));
        }
        return out;
    default:
        return out;
    }
}

/* Plain counts up or down depending on the two numbers. */
static Value plain_range(Value from, Value to, Value step) {
    double start = plain_number(from), finish = plain_number(to);
    double move = fabs(plain_number(step));
    Value out = plain_list_value();
    double at;
    if (move == 0) move = 1;
    if (finish < start) move = -move;
    for (at = start; move > 0 ? at <= finish : at >= finish; at += move) {
        plain_push(out, plain_number_value(at));
    }
    return out;
}

static size_t plain_count(Value value) {
    switch (value.kind) {
    case PLAIN_TEXT: return plain_utf8_count(value.obj->text, value.obj->bytes);
    case PLAIN_LIST: return value.obj->count;
    case PLAIN_THING: return value.obj->field_count;
    default: return 0;
    }
}

static Value plain_length(Value value) { return plain_number_value((double)plain_count(value)); }

/* Straight into a list by its place from 0, for the loops. */
static Value plain_index(Value list, size_t at) {
    if (list.kind != PLAIN_LIST || at >= list.obj->count) return plain_nothing();
    return list.obj->items[at];
}

/* Lists count from 1 in Plain, and a number below zero counts from the end. */
static long plain_place(double index, size_t len) {
    long at = (long)index;
    long place = at < 0 ? (long)len + at : at - 1;
    if (place < 0 || place >= (long)len) return -1;
    return place;
}

static Value plain_item(Value collection, Value index) {
    double at = plain_number(index);
    if (collection.kind == PLAIN_TEXT) {
        size_t letters = plain_utf8_count(collection.obj->text, collection.obj->bytes);
        long place = plain_place(at, letters);
        size_t from, to;
        if (place < 0) return plain_nothing();
        from = plain_utf8_skip(collection.obj->text, collection.obj->bytes, (size_t)place);
        to = plain_utf8_skip(collection.obj->text + from, collection.obj->bytes - from, 1);
        return plain_text_len(collection.obj->text + from, to);
    }
    if (collection.kind == PLAIN_LIST) {
        long place = plain_place(at, collection.obj->count);
        if (place < 0) return plain_nothing();
        return collection.obj->items[place];
    }
    return plain_nothing();
}

static Value plain_set_item(Value collection, Value index, Value value) {
    if (collection.kind == PLAIN_LIST) {
        long place = plain_place(plain_number(index), collection.obj->count);
        if (place >= 0) {
            plain_retain(value);
            plain_release(collection.obj->items[place]);
            collection.obj->items[place] = value;
        }
    }
    return collection;
}

static Value plain_at(Value *args, int count, int at) {
    if (!args || at >= count) return plain_nothing();
    return args[at];
}

static Value plain_first(Value collection) { return plain_item(collection, plain_number_value(1)); }
static Value plain_last(Value collection) { return plain_item(collection, plain_number_value((double)plain_count(collection))); }

static Value plain_total(Value collection) {
    Value all = plain_items(collection);
    double sum = 0;
    size_t at;
    for (at = 0; at < all.obj->count; at++) sum += plain_number(all.obj->items[at]);
    return plain_number_value(sum);
}

static Value plain_average(Value collection) {
    Value all = plain_items(collection);
    if (all.obj->count == 0) return plain_number_value(0);
    return plain_number_value(plain_number(plain_total(all)) / (double)all.obj->count);
}

static Value plain_highest(Value collection) {
    Value all = plain_items(collection);
    Value best = plain_nothing();
    size_t at;
    for (at = 0; at < all.obj->count; at++) {
        if (best.kind == PLAIN_NOTHING || plain_number(all.obj->items[at]) > plain_number(best)) {
            best = all.obj->items[at];
        }
    }
    return best;
}

static Value plain_lowest(Value collection) {
    Value all = plain_items(collection);
    Value best = plain_nothing();
    size_t at;
    for (at = 0; at < all.obj->count; at++) {
        if (best.kind == PLAIN_NOTHING || plain_number(all.obj->items[at]) < plain_number(best)) {
            best = all.obj->items[at];
        }
    }
    return best;
}

static int plain_sorting_numbers = 0;

static int plain_compare(const void *one, const void *other) {
    const Value *a = (const Value *)one;
    const Value *b = (const Value *)other;
    if (plain_sorting_numbers) {
        double left = plain_number(*a), right = plain_number(*b);
        return left < right ? -1 : left > right ? 1 : 0;
    } else {
        char *left = plain_show(*a);
        char *right = plain_show(*b);
        int order = strcmp(left, right);
        free(left);
        free(right);
        return order;
    }
}

/* Numbers sort as numbers, anything else as the words it reads as. */
static Value plain_sorted(Value collection) {
    Value all = plain_items(collection);
    size_t at;
    plain_sorting_numbers = 1;
    for (at = 0; at < all.obj->count; at++) {
        if (all.obj->items[at].kind != PLAIN_NUMBER) plain_sorting_numbers = 0;
    }
    if (all.obj->count > 1) qsort(all.obj->items, all.obj->count, sizeof(Value), plain_compare);
    return all;
}

static Value plain_reversed(Value collection) {
    Value all = plain_items(collection);
    Value out = plain_list_value();
    size_t at = all.obj->count;
    while (at > 0) plain_push(out, all.obj->items[--at]);
    return out;
}

static Value plain_copy(Value value) {
    if (value.kind == PLAIN_LIST) return plain_items(value);
    return value;
}

static Value plain_join_with(Value collection, Value separator) {
    Value all = plain_items(collection);
    char *between = plain_show(separator);
    char *out = NULL;
    size_t len = 0, room = 0, at;
    Value answer;
    plain_put("", 0, &out, &len, &room);
    for (at = 0; at < all.obj->count; at++) {
        char *one = plain_show(all.obj->items[at]);
        if (at) plain_put(between, strlen(between), &out, &len, &room);
        plain_put(one, strlen(one), &out, &len, &room);
        free(one);
    }
    answer = plain_text_len(out, len);
    free(out);
    free(between);
    return answer;
}

static Value plain_position(Value collection, Value value) {
    size_t at;
    if (collection.kind == PLAIN_TEXT) {
        char *wanted = plain_show(value);
        char *found = strstr(collection.obj->text, wanted);
        double place = found ? (double)(plain_utf8_count(collection.obj->text, (size_t)(found - collection.obj->text)) + 1) : 0;
        free(wanted);
        return plain_number_value(place);
    }
    {
        Value all = plain_items(collection);
        for (at = 0; at < all.obj->count; at++) {
            if (plain_alike(all.obj->items[at], value)) return plain_number_value((double)(at + 1));
        }
    }
    return plain_number_value(0);
}

static Value plain_has(Value container, Value value) {
    size_t at;
    if (container.kind == PLAIN_TEXT) {
        char *wanted = plain_show(value);
        int found = strstr(container.obj->text, wanted) != NULL;
        free(wanted);
        return plain_bool(found);
    }
    {
        Value all = plain_items(container);
        for (at = 0; at < all.obj->count; at++) {
            if (plain_alike(all.obj->items[at], value)) return plain_bool(1);
        }
    }
    return plain_bool(0);
}

/* "add x to name" grows a list, adds to a number, or joins text. */
static Value plain_add_to(Value current, Value value) {
    if (current.kind == PLAIN_LIST) {
        plain_push(current, value);
        return current;
    }
    if (current.kind == PLAIN_TEXT) return plain_join2(current, value);
    return plain_number_value(plain_number(current) + plain_number(value));
}

static Value plain_remove_value(Value collection, Value value) {
    size_t at;
    if (collection.kind != PLAIN_LIST) return collection;
    for (at = 0; at < collection.obj->count; at++) {
        if (plain_alike(collection.obj->items[at], value)) {
            plain_release(collection.obj->items[at]);
            memmove(collection.obj->items + at, collection.obj->items + at + 1,
                    (collection.obj->count - at - 1) * sizeof(Value));
            collection.obj->count--;
            return collection;
        }
    }
    return collection;
}

static Value plain_remove_at(Value collection, Value index) {
    long at = (long)plain_number(index);
    if (collection.kind != PLAIN_LIST) return collection;
    if (at >= 1 && at <= (long)collection.obj->count) {
        plain_release(collection.obj->items[at - 1]);
        memmove(collection.obj->items + at - 1, collection.obj->items + at,
                (collection.obj->count - at) * sizeof(Value));
        collection.obj->count--;
    }
    return collection;
}

static Value plain_emptied(Value value) {
    if (value.kind == PLAIN_LIST) return plain_list_value();
    return plain_nothing();
}

/* ---------------------------------------------------------- named values */

static Value plain_field(Value thing, const char *name) {
    long found = plain_field_at(thing, name);
    if (found >= 0) return thing.obj->fields[found];
    if (thing.kind == PLAIN_LIST || thing.kind == PLAIN_TEXT) {
        if (strcmp(name, "length") == 0 || strcmp(name, "size") == 0 || strcmp(name, "count") == 0) {
            return plain_length(thing);
        }
    }
    return plain_nothing();
}

static Value plain_set_field(Value thing, const char *name, Value value) {
    if (thing.kind == PLAIN_THING) plain_own(thing, name, value);
    return plain_nothing();
}

static Value plain_value(Value thing, Value key) {
    char *name = plain_show(key);
    Value out = plain_field(thing, name);
    free(name);
    return out;
}

static Value plain_set_value(Value thing, Value key, Value value) {
    char *name = plain_show(key);
    plain_set_field(thing, name, value);
    free(name);
    return plain_nothing();
}

static Value plain_has_key(Value thing, Value key) {
    char *name = plain_show(key);
    int found = plain_field_at(thing, name) >= 0;
    free(name);
    return plain_bool(found);
}

static Value plain_keys(Value thing) {
    Value out = plain_list_value();
    size_t at;
    if (thing.kind != PLAIN_THING) return out;
    for (at = 0; at < thing.obj->field_count; at++) plain_push(out, plain_text_value(thing.obj->names[at]));
    return out;
}

static Value plain_values(Value thing) {
    Value out = plain_list_value();
    size_t at;
    if (thing.kind != PLAIN_THING) return out;
    for (at = 0; at < thing.obj->field_count; at++) plain_push(out, thing.obj->fields[at]);
    return out;
}

/* ------------------------------------------------------ kinds of your own */

static Value plain_tell(Value thing, const char *action, Value *args, int count) {
    const char *kind;
    const char *looking;
    if (thing.kind != PLAIN_THING) plain_fail("I can only tell one of your own kinds to do something");
    kind = thing.obj->thing_kind;
    looking = kind;
    while (looking && looking[0]) {
        Value answer;
        if (plain_do(looking, action, thing, args, count, &answer)) return answer;
        looking = plain_base(looking);
    }
    plain_fail("A %s does not know how to \"%s\"", kind, action);
    return plain_nothing();
}

static Value plain_is_kind(Value thing, const char *wanted) {
    const char *looking;
    if (thing.kind != PLAIN_THING) return plain_bool(0);
    looking = thing.obj->thing_kind;
    while (looking && looking[0]) {
        if (strcmp(looking, wanted) == 0) return plain_bool(1);
        looking = plain_base(looking);
    }
    return plain_bool(0);
}

static Value plain_kind_of(Value value) {
    switch (value.kind) {
    case PLAIN_NOTHING: return plain_text_value("nothing");
    case PLAIN_BOOL: return plain_text_value("a yes/no");
    case PLAIN_NUMBER: return plain_text_value("a number");
    case PLAIN_TEXT: return plain_text_value("text");
    case PLAIN_LIST: return plain_text_value("a list");
    case PLAIN_THING: return plain_text_value("a thing");
    default: return plain_text_value("an action");
    }
}

static Value plain_kind_name(Value thing) {
    if (thing.kind == PLAIN_THING && thing.obj->thing_kind && thing.obj->thing_kind[0]) {
        return plain_text_value(thing.obj->thing_kind);
    }
    return plain_kind_of(thing);
}

/* -------------------------------------------------------------- actions */

/* Calling something with the values written out one after another, rather
 * than gathered into a list first, so the program reads as it was written. */
static Value plain_tell_with(Value thing, const char *action, int count, ...) {
    Value args[4];
    va_list rest;
    int at;
    va_start(rest, count);
    for (at = 0; at < count && at < 4; at++) args[at] = va_arg(rest, Value);
    va_end(rest);
    return plain_tell(thing, action, args, count);
}

static Value plain_run(Value action, Value *args, int count) {
    if (action.kind != PLAIN_ACTION) plain_fail("That is not an action, so I cannot run it");
    return action.obj->doing(args, count);
}

static Value plain_run_with(Value action, int count, ...) {
    Value args[4];
    va_list rest;
    int at;
    va_start(rest, count);
    for (at = 0; at < count && at < 4; at++) args[at] = va_arg(rest, Value);
    va_end(rest);
    return plain_run(action, args, count);
}

/* A problem raised by the program itself, in its own words. */
static void plain_fail_value(Value words) {
    char *said = plain_show(words);
    char copy[512];
    strncpy(copy, said, sizeof(copy) - 1);
    copy[sizeof(copy) - 1] = 0;
    free(said);
    plain_fail("%s", copy);
}

static Value plain_changed_by(Value collection, Value action) {
    Value all = plain_items(collection);
    Value out = plain_list_value();
    size_t at;
    for (at = 0; at < all.obj->count; at++) {
        Value one = all.obj->items[at];
        plain_push(out, plain_run(action, &one, 1));
    }
    return out;
}

static Value plain_kept_where(Value collection, Value action) {
    Value all = plain_items(collection);
    Value out = plain_list_value();
    size_t at;
    for (at = 0; at < all.obj->count; at++) {
        Value one = all.obj->items[at];
        if (plain_truthy(plain_run(action, &one, 1))) plain_push(out, one);
    }
    return out;
}

static Value plain_added_up_by(Value collection, Value action) {
    Value all = plain_items(collection);
    double sum = 0;
    size_t at;
    for (at = 0; at < all.obj->count; at++) {
        Value one = all.obj->items[at];
        sum += plain_number(plain_run(action, &one, 1));
    }
    return plain_number_value(sum);
}

/* ----------------------------------------------------------------- text */

static Value plain_upper(Value text) {
    char *said = plain_show(text);
    size_t at, len = strlen(said);
    Value out;
    for (at = 0; at < len; at++) {
        if (said[at] >= 'a' && said[at] <= 'z') said[at] = (char)(said[at] - 32);
    }
    out = plain_text_len(said, len);
    free(said);
    return out;
}

static Value plain_lower(Value text) {
    char *said = plain_show(text);
    size_t at, len = strlen(said);
    Value out;
    for (at = 0; at < len; at++) {
        if (said[at] >= 'A' && said[at] <= 'Z') said[at] = (char)(said[at] + 32);
    }
    out = plain_text_len(said, len);
    free(said);
    return out;
}

static Value plain_trimmed(Value text) {
    char *said = plain_show(text);
    char *from = said;
    char *to;
    Value out;
    while (*from == ' ' || *from == '\t' || *from == '\n' || *from == '\r') from++;
    to = from + strlen(from);
    while (to > from && (to[-1] == ' ' || to[-1] == '\t' || to[-1] == '\n' || to[-1] == '\r')) to--;
    out = plain_text_len(from, (size_t)(to - from));
    free(said);
    return out;
}

static Value plain_split(Value text, Value separator) {
    char *whole = plain_show(text);
    char *between = plain_show(separator);
    Value out = plain_list_value();
    size_t gap = strlen(between);
    char *at = whole;
    if (gap == 0) {
        size_t seen = 0, bytes = strlen(whole);
        while (seen < bytes) {
            size_t next = plain_utf8_skip(whole + seen, bytes - seen, 1);
            plain_push(out, plain_text_len(whole + seen, next));
            seen += next;
        }
    } else {
        for (;;) {
            char *found = strstr(at, between);
            if (!found) {
                plain_push(out, plain_text_value(at));
                break;
            }
            plain_push(out, plain_text_len(at, (size_t)(found - at)));
            at = found + gap;
        }
    }
    free(whole);
    free(between);
    return out;
}

static Value plain_part(Value text, Value start, Value finish) {
    char *said = plain_show(text);
    size_t bytes = strlen(said);
    size_t letters = plain_utf8_count(said, bytes);
    long from = (long)plain_number(start) - 1;
    long to = (long)plain_number(finish);
    size_t first, past;
    Value out;
    if (from < 0) from = 0;
    if (to > (long)letters) to = (long)letters;
    if (from >= to) {
        free(said);
        return plain_text_value("");
    }
    first = plain_utf8_skip(said, bytes, (size_t)from);
    past = plain_utf8_skip(said, bytes, (size_t)to);
    out = plain_text_len(said + first, past - first);
    free(said);
    return out;
}

static Value plain_replace(Value text, Value find, Value instead) {
    char *whole = plain_show(text);
    char *looking = plain_show(find);
    char *swap = plain_show(instead);
    char *out = NULL;
    size_t len = 0, room = 0, gap = strlen(looking);
    char *at = whole;
    Value answer;
    plain_put("", 0, &out, &len, &room);
    if (gap == 0) {
        plain_put(whole, strlen(whole), &out, &len, &room);
    } else {
        for (;;) {
            char *found = strstr(at, looking);
            if (!found) {
                plain_put(at, strlen(at), &out, &len, &room);
                break;
            }
            plain_put(at, (size_t)(found - at), &out, &len, &room);
            plain_put(swap, strlen(swap), &out, &len, &room);
            at = found + gap;
        }
    }
    answer = plain_text_len(out, len);
    free(out);
    free(whole);
    free(looking);
    free(swap);
    return answer;
}

static Value plain_starts_with(Value text, Value prefix) {
    char *whole = plain_show(text);
    char *front = plain_show(prefix);
    int yes = strncmp(whole, front, strlen(front)) == 0;
    free(whole);
    free(front);
    return plain_bool(yes);
}

static Value plain_ends_with(Value text, Value suffix) {
    char *whole = plain_show(text);
    char *back = plain_show(suffix);
    size_t one = strlen(whole), other = strlen(back);
    int yes = other <= one && strcmp(whole + one - other, back) == 0;
    free(whole);
    free(back);
    return plain_bool(yes);
}

/* -------------------------------------------------------------- numbers */

static Value plain_round(Value value) { return plain_number_value(floor(plain_number(value) + 0.5)); }

static Value plain_round_to(Value value, Value places) {
    double scale = pow(10, floor(plain_number(places)));
    return plain_number_value(floor(plain_number(value) * scale + 0.5) / scale);
}

static Value plain_floor(Value value) { return plain_number_value(floor(plain_number(value))); }
static Value plain_ceiling(Value value) { return plain_number_value(ceil(plain_number(value))); }
static Value plain_absolute(Value value) { return plain_number_value(fabs(plain_number(value))); }

static Value plain_square_root(Value value) {
    double number = plain_number(value);
    return plain_number_value(sqrt(number < 0 ? 0 : number));
}

static Value plain_sine(Value value) { return plain_number_value(sin(plain_number(value))); }
static Value plain_cosine(Value value) { return plain_number_value(cos(plain_number(value))); }
static Value plain_tangent(Value value) { return plain_number_value(tan(plain_number(value))); }
static Value plain_exponent(Value value) { return plain_number_value(exp(plain_number(value))); }

static Value plain_logarithm(Value value) {
    double number = plain_number(value);
    return plain_number_value(log(number < 1e-300 ? 1e-300 : number));
}

static Value plain_smaller(Value a, Value b) {
    double left = plain_number(a), right = plain_number(b);
    return plain_number_value(left < right ? left : right);
}

static Value plain_bigger(Value a, Value b) {
    double left = plain_number(a), right = plain_number(b);
    return plain_number_value(left > right ? left : right);
}

static Value plain_pi(void) { return plain_number_value(3.14159265358979311600); }
static Value plain_e(void) { return plain_number_value(2.71828182845904509080); }

/* C's own rand is too coarse and differs between compilers, so here is the
 * xorshift a great many programs use, started from the clock. */
static unsigned long long plain_seed = 0;

static double plain_random(void) {
    unsigned long long x;
    if (plain_seed == 0) plain_seed = (unsigned long long)time(NULL) * 2654435761u | 1;
    x = plain_seed;
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    plain_seed = x;
    return (double)(x >> 11) / 9007199254740992.0;
}

static Value plain_random_number(void) { return plain_number_value(plain_random()); }

static Value plain_random_between(Value low, Value high) {
    double from = ceil(plain_number(low));
    double to = floor(plain_number(high));
    double span;
    if (to < from) return plain_number_value(from);
    span = to - from + 1;
    return plain_number_value(from + floor(plain_random() * span));
}

static Value plain_random_item(Value collection) {
    Value all = plain_items(collection);
    if (all.obj->count == 0) return plain_nothing();
    return all.obj->items[(size_t)(plain_random() * (double)all.obj->count) % all.obj->count];
}

// Every item swapped with one somewhere at or before it, which is the only
// shuffle that treats every order as equally likely.
static Value plain_shuffled(Value collection) {
    Value all = plain_items(collection);
    size_t at = all.obj->count;
    while (at > 1) {
        at--;
        size_t other = (size_t)(plain_random() * (double)(at + 1));
        if (other > at) other = at;
        Value held = all.obj->items[at];
        all.obj->items[at] = all.obj->items[other];
        all.obj->items[other] = held;
    }
    return all;
}

static Value plain_time_now(void) {
    return plain_number_value((double)time(NULL) * 1000.0);
}

static Value plain_today(void) {
    char buffer[32];
    time_t now = time(NULL);
    struct tm *when = localtime(&now);
    snprintf(buffer, sizeof(buffer), "%04d-%02d-%02d", when->tm_year + 1900, when->tm_mon + 1, when->tm_mday);
    return plain_text_value(buffer);
}

/* Reads one line, the way "ask ... into ..." does in Plain. */
static Value plain_ask(Value question) {
    char line[1024];
    char *stopped = NULL;
    double found;
    char *said = plain_show(question);
    printf("%s", said);
    free(said);
    fflush(stdout);
    if (!fgets(line, sizeof(line), stdin)) return plain_text_value("");
    {
        size_t len = strlen(line);
        while (len > 0 && (line[len - 1] == '\n' || line[len - 1] == '\r')) line[--len] = 0;
    }
    found = strtod(line, &stopped);
    if (line[0] && stopped && *stopped == 0) return plain_number_value(found);
    return plain_text_value(line);
}

/* Everything still standing when the program ends, including whatever was
 * tied in a knot. Nothing counts anything here: what a list was holding is
 * on this same list and will be freed in its own turn, and reaching into it
 * to say so would be reaching into memory already given back. */
static void plain_free_alone(PlainObj *obj) {
    size_t at;
    if (obj->text) free(obj->text);
    if (obj->items) free(obj->items);
    if (obj->names) {
        for (at = 0; at < obj->field_count; at++) free(obj->names[at]);
        free(obj->names);
    }
    if (obj->fields) free(obj->fields);
    if (obj->thing_kind) free(obj->thing_kind);
    free(obj);
}

static void plain_done(void) {
    size_t at;
    for (at = 0; at < plain_pool_count; at++) plain_free_alone(plain_pool[at]);
    plain_pool_count = 0;
    if (plain_pool) free(plain_pool);
    plain_pool = NULL;
    plain_pool_room = 0;
}
