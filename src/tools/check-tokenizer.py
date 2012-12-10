#! /usr/bin/env python
# -*- coding: utf-8 -*-

import sys, traceback, os
import datetime, time
import random, math

try: import simplejson as json
except ImportError: import json

from tornado import web
from tornadio2 import SocketConnection, TornadioRouter, SocketServer, event

from casmacat import *
#from numpy.testing.utils import elapsed


def fmt_delta(elapsed_time):
  h, rem = divmod(elapsed_time.seconds, 3600)
  m , rem = divmod(rem, 60)
  s = math.floor(rem)
  ms = elapsed_time.microseconds/1000.0

  time = []
  if elapsed_time.days > 0: 
    time.append("%d days" % (days))
  if h > 0:
    time.append("%dh" % (h))
  if m > 0:
    time.append("%dm" % (m))
  if s > 0:
    time.append("%ds" % (s))
  time.append("%.2fms" % ms)
  return " ".join(time) 

# decorator to measure the time to process the function 
class timer(object):
  def __init__(self, name):
    """
    If there are decorator arguments, the function
    to be decorated is not passed to the constructor!
    """
    self.name = name 

  def __call__(self, function):
    """
    If there are decorator arguments, __call__() is only called
    once, as part of the decoration process! You can only give
    it a single argument, which is the function object.
    """
    def decorator(*args, **kwargs):
      start_time = datetime.datetime.now()
      ret = function(*args, **kwargs)
      elapsed_time = datetime.datetime.now() - start_time
      print "TIME:%s:%s" % (self.name, fmt_delta(elapsed_time))
      return ret
    return decorator

class Models:
  def __init__(self, config_fn):
    self.config = json.load(open(config_fn))
    print >> sys.stderr, "config", json.dumps(self.config)
  
  @timer('create_plugins')
  def create_plugins(self):
    start_time = datetime.datetime.now()
    self.tokenizer_plugin = TextProcessorPlugin(self.config["text-processor"]["module"], self.config["text-processor"]["parameters"])
    self.tokenizer_factory = self.tokenizer_plugin.create()
    if not self.tokenizer_factory: raise Exception("Tokenizer plugin failed")
    self.tokenizer = self.tokenizer_factory.createInstance()
    if not self.tokenizer: raise Exception("Tokenizer instance failed")
    elapsed_time = datetime.datetime.now() - start_time
    print "TIME:%s loaded:%s" % ("tokenizer", fmt_delta(elapsed_time))

    print >> sys.stderr, "Plugins loaded"
  
  
  @timer('delete_plugins')
  def delete_plugins(self):
    self.tokenizer_factory.deleteInstance(self.tokenizer);
    self.tokenizer_plugin.destroy(self.tokenizer_factory)
    self.tokenizer, self.tokenizer_factory = None, None
    del self.tokenizer_plugin


if __name__ == "__main__":
    from sys import argv
    import logging
    import atexit

    models = Models(sys.argv[1])
    models.create_plugins()
    atexit.register(models.delete_plugins)

    #@timer('tokenize')
    def tokenize(line):
      return models.tokenizer.preprocess(line)
      
    #@timer('detokenize')
    def detokenize(tokens):
      return models.tokenizer.postprocess(tokens)
      


    s = .0
    n = 0
    b = 0
    for line in open(sys.argv[2]):
      n += 1
      line = line.strip()

      start_time = datetime.datetime.now()
      line_tok, line_seg = tokenize(line)
      new_line, new_line_seg = detokenize(line_tok)
      elapsed_time = datetime.datetime.now() - start_time

      if line != new_line:
        b += 1
        print n, line
        print n, new_line
      else:
        print n, "OK!"

      s += elapsed_time.seconds*1000.0 + elapsed_time.microseconds/1000.0

    print "avg elapsed time %.2fms" % (s/n)
    print "inconsistent tokenizations %d" % b
