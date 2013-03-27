# -*- coding: utf-8 -*-

from casmacat import *

class PythonImtSession(IInteractiveMtSession):
  def __init__(self, source):
    self.source = source

  def setPrefix(self, prefix, suffix, last_token_is_partial):
    return list(prefix) + ["word1", "word2"]

  def rejectSuffix(self, prefix, suffix, last_token_is_partial):
    return list(prefix) + ["not-suffix-word1", "word2"]

  # at this moment this function will not be called
  def setPartialValidation(partial_translation, validated):
    corrected_translation = ["new", "translation", "that", "keeps", "validated", "words"]
    corrected_validated = [ 0, 1, 1, 0, 0, 1 ]
    return corrected_translation, corrected_validated


class PythonImtEngine(IInteractiveMtEngine):
  def __init__(self, argv):
    print argv

  def newSession(self, source):
    return PythonImtSession(source)

  def deleteSession(self, session):
    del session

  # Update translation models with source/target pair (total or partial translation) 
  def validate(source, target, validated):
    pass


class PythonAlignmentEngine(IAlignmentEngine): 
  def __init__(self, argv):
    print argv

  # obtain an alignment matrix from the source and target sentences
  def align(self, source, target):
    alignments = [[0]*len(target) for _ in range(len(source))]
    return alignments

class PythonConfidenceEngine(IConfidenceEngine):
  def __init__(self, argv):
    print argv

  def getSentenceConfidence(self, source, target, validated):
    sent_confidence = 0.75
    return sent_confidence
    
  def getWordConfidences(self, source, target, validated):
    sent_confidence = self.getSentenceConfidence(source, target, validated) 
    word_confidence = [ 0.5 ] * len(target)
    return sent_confidence, word_confidence

class PythonMtEngine(IMtEngine):
  def __init__(self, argv):
    print argv

  #  translates a sentence in a source language into a sentence in a target language
  # 
  #  This is a simplified version of the MT engine in D5.1: Specification of casmacat workbench
  #  since this version does not take into account the optional parameters, as they are specific for
  #  Moses. The original description is the following:
  # 
  #  translates sentence specified as `text'. If `align' switch is on, phrase alignment is returned.
  #  If ’sg’ is on, search graph is returned. If ’topt’ is on, phrase options used are returned.
  #  If ’report-all-factors’ is on, all factors are included in output. ’presence’ means that the
  #  switch is on, if the category appears in the xml,value can be anything
  # 
  #  @param[in] source a sentence in the source language
  #  @param[out] target a translation of source in the target language
  def translate(self, source):
    target = ["word1", "word2"]
    return target 

class PythonTextProcessor(ITextProcessor):
  def __init__(self, argv):
    print argv

  def preprocess(self, detokenized):
    tokenized = ["word1", "word2"]
    segmentation = [ [0, 5], [6, 11] ]
    return tokenized, segmentation

  def postprocess(self, tokenized):
    detokenized = "word1 word2"
    segmentation = [ [0, 5], [6, 11] ]
    return detokenized, segmentation

