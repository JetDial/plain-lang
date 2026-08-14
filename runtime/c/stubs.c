/* Plain - the three tables a program writes for itself.
 *
 * runtime/c/plain.c leans on these, and the translator writes a real one of
 * each for every program. These empty ones exist so the runtime can be
 * built and checked on its own, which the test suite does.
 */

static void plain_defaults(const char *kind, Value into) {
    (void)kind;
    (void)into;
}

static const char *plain_base(const char *kind) {
    (void)kind;
    return NULL;
}

static int plain_do(const char *kind, const char *action, Value me, Value *args, int count, Value *answer) {
    (void)kind;
    (void)action;
    (void)me;
    (void)args;
    (void)count;
    (void)answer;
    return 0;
}

int main(void) {
    PlainFrame frame;
    PlainCatch spot;
    Value list = plain_nothing();
    plain_enter(&frame);
    plain_local(&frame, &list);

    /* Enough to prove the runtime holds together and agrees with Plain. */
    plain_say(plain_add(plain_number_value(0.1), plain_number_value(0.2)));
    plain_say(plain_divide(plain_number_value(10), plain_number_value(4)));

    plain_keep(&list, plain_list_of(3, plain_number_value(3), plain_number_value(1), plain_number_value(2)));
    plain_say(plain_sorted(list));
    plain_say(plain_item(list, plain_number_value(1)));
    plain_say(plain_join_with(list, plain_text_value("-")));
    plain_say(plain_part(plain_text_value("Hello, World"), plain_number_value(1), plain_number_value(5)));

    plain_push_catch(&spot);
    if (PLAIN_SETJMP(spot.jump) == 0) {
        plain_divide(plain_number_value(1), plain_number_value(0));
        plain_pop_catch();
    } else {
        plain_pop_catch();
        plain_say(plain_text_value(spot.words));
    }

    plain_sweep(&frame);
    plain_leave(&frame, plain_nothing());
    plain_done();
    return 0;
}
