#!/usr/bin/python
#
# \file   main.py
# \author Martin Reddy
# \brief  Demonstrate calling a C++ API from Python. 
#
# Copyright (c) 2010, Martin Reddy. All rights reserved.
# Distributed under the X11/MIT License. See LICENSE.txt.
# See http://APIBook.com/ for the latest version.
#

from casmacat import *
from sys import stderr, stdout

class MyLogger(Logger):
  tag = { ERROR_LOG: "ERROR:", WARN_LOG: "WARN:", INFO_LOG: "INFO:", DEBUG_LOG: "DEBUG:" }
  def log(self, type, msg):
    if type in self.tag:
      print >> stderr, self.tag[type], msg
    else: 
      print >> stderr, "LOG:", msg

logger = MyLogger()

text_p = TextProcessorPlugin(".libs/space-tokenizer.so")
text_f = text_p.create()
text_f.setLogger(logger)
processor = text_f.createInstance()

mt_p = MtPlugin(".libs/random-mt-engine.so")
mt_f = mt_p.create()
mt_f.setLogger(logger)
mt = mt_f.createInstance()


conf_p = ConfidencePlugin(".libs/random-confidence-estimator.so")
conf_f = conf_p.create()
conf_f.setLogger(logger)
confidencer = conf_f.createInstance()

alig_p = AlignmentPlugin(".libs/random-aligner.so")
alig_f = alig_p.create()
alig_f.setLogger(logger)
aligner = alig_f.createInstance()

source = "Hello World!"
source_tok = processor.preprocess(source)
print "Source tok:", source_tok

target_tok = mt.translate(source_tok)
print "Target tok:", target_tok

target, target_seg = processor.postprocess(target_tok)
print "target: '%s'" % target
print "segmentation:", target_seg

correct = BoolVector([False for x in range(len(target_tok))])
print confidencer.getWordConfidences(source_tok, target_tok, correct)
sent, conf = confidencer.getWordConfidences(source_tok, target_tok, correct)
print "Confidences:", conf

matrix = aligner.align(source_tok, target_tok)
print "Alignments:", matrix


del processor, text_f, text_p
del mt, mt_f, mt_p
del confidencer, conf_f, conf_p
del aligner, alig_f, alig_p
