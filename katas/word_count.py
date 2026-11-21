"""Count the words in a sentence."""


def word_count(sentence):
    """
    Counts how many words are in a sentence.

    A new word starts when we find a non-whitespace character
    while we are not already inside a word.
    """
    count = 0
    in_word = False

    for char in sentence:
        if char.isspace():
            in_word = False
        else:
            if not in_word:
                count += 1
                in_word = True

    return count


if __name__ == '__main__':
    print(word_count("hello world"))          # 2
    print(word_count("  one   two three "))   # 3
