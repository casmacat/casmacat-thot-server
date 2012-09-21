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
  tag = { ERROR_LOG: "ERROR:", WARN_LOG: "WARN:", INFO_LOG: "INFO:", DEBUG_LOG: "DEBUG" }
  def log(self, type, msg):
    if type in self.tag:
      print >> stderr, self.tag[type], msg
    else: 
      print >> stderr, "LOG:", msg

logger = MyLogger()

plugin = ConfidencePlugin(".libs/random-confidence-estimator.so")
factory = plugin.create()

logger.log(DEBUG_LOG, "I exist")
factory.setLogger(logger)

print factory.getVersion()
c = factory.createInstance()

#print c.getSentenceConfidence(["a", "b"], ["A", "B"], [False, True])

conf = FloatVector()
c.getWordConfidences(StringVector("a b".split()), StringVector("c d".split()), BoolVector([False, True]), conf)
print list(conf)

#plugin.destroy(c)
#plugin.destroy(factory)
del c
del factory
