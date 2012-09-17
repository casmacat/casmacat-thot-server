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

plugin = ConfidencePlugin(".libs/random-confidence-estimator.so")
c = plugin.create()

print c.getVersion()

#print c.getSentenceConfidence(["a", "b"], ["A", "B"], [False, True])

conf = FloatVector()
c.getWordConfidences(StringVector("a b".split()), StringVector("c d".split()), BoolVector([False, True]), conf)
print list(conf)

plugin.destroy(c)
del c

print c.getVersion()

raw_input("press ENTER to continue...")
