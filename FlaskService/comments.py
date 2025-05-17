from flask import Blueprint, request, jsonify
import logging
import re
import spacy
import pickle
import pymorphy2

comments_bp = Blueprint('comments', __name__)

morph = pymorphy2.MorphAnalyzer()

# Функция для лемматизации текста
def lemmatize_word(word):
    parsed_word = morph.parse(word)[0]  
    return parsed_word.normal_form

# Функция для нормализации текста
def normalize_text(text):
    text = ' '.join(text.split())
    substitution_dict = {
        'а': ['а', 'a', '@'], 'б': ['б', '6', 'b'], 'в': ['в', 'b', 'v'],
        'г': ['г', 'r', 'g'], 'д': ['д', 'd'], 'е': ['е', 'e', '3'], 'ё': ['ё', 'e'],
        'ж': ['ж', 'zh', '*'], 'з': ['з', '3', 'z'], 'и': ['и', 'u', 'i'],
        'й': ['й', 'u', 'i'], 'к': ['к', 'k', 'i{', '|{'], 'л': ['л', 'l', 'ji'],
        'м': ['м', 'm'], 'н': ['н', 'h', 'n'], 'о': ['о', 'o', '0'],
        'п': ['п', 'n', 'p'], 'р': ['р', 'r', 'p'], 'с': ['с', 'c', 's'],
        'т': ['т', 'm', 't'], 'у': ['у', 'y', 'u'], 'ф': ['ф', 'f'],
        'х': ['х', 'x', 'h', '}{'], 'ц': ['ц', 'c', 'u,'], 'ч': ['ч', 'ch'],
        'ш': ['ш', 'sh'], 'щ': ['щ', 'sch'], 'ь': ['ь', 'b'], 'ы': ['ы', 'bi'],
        'ъ': ['ъ'], 'э': ['э', 'e'], 'ю': ['ю', 'io'], 'я': ['я', 'ya']
    }
    for key, values in substitution_dict.items():
        for value in values:
            text = text.replace(value, key)
    return text

# Функция для удаления повторяющихся символов в слове
def remove_repeated_chars(word):
    return ''.join([char for i, char in enumerate(word) if (i == 0 or char != word[i - 1])])

# Лемматизация текста
def lemmatize_text_spacy(text):
    doc = nlp(text)
    return ' '.join([token.lemma_ for token in doc if not token.is_stop and not token.is_punct])

# Функция для проверки на оскорбительный комментарий
def check_if_offensive(text):
    lemmatized_text = lemmatize_text_spacy(text)  
    lemmatized_text = ' '.join([remove_repeated_chars(word) for word in lemmatized_text.split()])
    
    text_tfidf = vectorizer.transform([lemmatized_text])  
    predicted_class = model_of_com.predict(text_tfidf)  

    return predicted_class[0] == "Отрицательный"

@comments_bp.route('/check_comments', methods=['POST'])
def check_comments():
    comments = request.get_json(force=True)
    offensive_comments = []

    for comment in comments:
        text = comment['text']
        if check_if_offensive(text):
            offensive_comments.append(comment)

    return jsonify(offensive_comments)

# Загрузка модели обработки естественного языка для русского языка
nlp = spacy.load('ru_core_news_sm')

# Загрузка модели для извлечения оскорбительных комментариев
with open('model_of_comment.pkl', 'rb') as f:
    model_of_com = pickle.load(f)

# Загрузка векторизатора для извлечения оскорбительных комментариев
with open('vectorizer.pkl', 'rb') as f:
    vectorizer = pickle.load(f)
