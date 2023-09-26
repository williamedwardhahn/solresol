# Step 1: Load the Solresol Dictionary from the URL
import pandas as pd
import numpy as np

# Step 1: Load the Solresol Dictionary from the URL
import pandas as pd
import numpy as np

df1 = pd.read_csv("https://docs.google.com/spreadsheets/d/1eSIfSpSsBdLXkKbnLhD-pPP92iNPKeqDsWnB-z0aZ0k/export?format=csv", header=None).replace(np.nan, '', regex=True)

# Convert both the keys and values to lowercase and strip any leading/trailing spaces
solresol_translation = dict(zip(df1[0].str.lower().str.strip(), df1[1].str.lower().str.strip()))


# Step 2: Define Number to Solresol Mapping
num_to_solresol = {
    '1': 'Do',
    '2': 'Re',
    '3': 'Mi',
    '4': 'Fa',
    '5': 'Sol',
    '6': 'La',
    '7': 'Si'
}

def get_solresol_word(number_sequence):
    # Step 4: Parse Input into Single Digits
    digits = list(number_sequence)

    # Step 5: Convert Digits to Solresol Syllables
    solresol_syllables = [num_to_solresol[digit] for digit in digits if digit in num_to_solresol]

    # Step 6: Form the Solresol Word
    solresol_word = ''.join(solresol_syllables)

    return solresol_word

def get_english_translation(solresol_word):
    # Step 7: Translate to English
    return solresol_translation.get(solresol_word, "Unknown Word")

# Step 3: Take User Input
def solresol_translator():
    number_sequence = input("Enter a sequence of numbers (1-7) to translate to Solresol: ")
    solresol_word = get_solresol_word(number_sequence).lower()
    translation = get_english_translation(solresol_word)
    print(f"Solresol Word: {solresol_word}")
    print(f"English Translation: {translation}")

# For demonstration purposes, let's run the translator once
while 1:
    solresol_translator()

