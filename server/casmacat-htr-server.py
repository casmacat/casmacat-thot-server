#! /usr/bin/env python
# -*- coding: utf-8 -*-

import sys, os
import datetime, time
import random


from tornado import web
from tornadio2 import SocketConnection, TornadioRouter, SocketServer, event

from casmacat import *


do_partial_recognition = True

class MyLogger(Logger):
  tag = { ERROR_LOG: "ERROR", WARN_LOG: "WARN", INFO_LOG: "INFO", DEBUG_LOG: "DEBUG" }
  participants = set()

  def log(self, type, msg):
    if type in self.tag:
      msg = "%s: %s" % (self.tag[type], msg)
    else: 
      msg = "LOG: %s" % msg
    for p in self.participants:
      p.emit('receive_log', msg)
    
logger = MyLogger()


def dump_strokes(strokes):
  fn = "strokes/" + str(time.time()) + ".moto";
  out = open(fn, "w")
  print >> out, "<unk>"
  print >> out, len(strokes)
  for points, is_pen_down in strokes:
    print >> out, len(points)
    if is_pen_down:
      print >> out, 1
    else: 
      print >> out, 0
    for x, y in points:
      print >> out, int(round(x)), int(round(y))
  out.close()


ROOT = os.path.normpath(os.path.dirname(__file__))

def filter_utf8(string):
  return string.encode('utf-8')

def to_utf8(obj):
  if isinstance(obj, basestring):
    return filter_utf8(obj)
  elif isinstance(obj, list): 
    return [to_utf8(w) for w in obj]
  raise "Unknown type"


class HtrConnection(SocketConnection):
    @event
    def start_htr_session(self, source, target, caret_pos):
      if self.htr_session: 
        htr.deleteSession(self.htr_session)
        self.htr_session = None
        self.strokes = None

      logger.log(DEBUG_LOG, str(caret_pos) + " @ " + to_utf8(target));

      source = to_utf8(source) 
      source_tok, source_seg = tokenizer.preprocess(source)
      print >> sys.stderr, "source", source

      prefix = to_utf8(target[:caret_pos]) 
      prefix_tok, prefix_seg = tokenizer.preprocess(prefix)
      print >> sys.stderr, "prefix", prefix

      suffix = to_utf8(target[caret_pos:]) 
      suffix_tok, suffix_seg = tokenizer.preprocess(suffix)
      print >> sys.stderr, "suffix", suffix 

      last_token_is_partial = False
      if len(suffix) != 0 and not suffix[0].isspace():
        last_token_is_partial = True
      print >> sys.stderr, "last_token_is_partial", last_token_is_partial 

      self.htr_session = htr.createSessionFromPrefix(source_tok, prefix_tok, suffix_tok, last_token_is_partial)
      self.strokes = []

    @event
    def add_stroke(self, points, is_pen_down):
      if self.htr_session:
        self.strokes.append((points, is_pen_down)) 
        for x, y in points:
            self.htr_session.addPoint(x, y, is_pen_down)
        self.htr_session.addPoint(0, 0, False)
        
        if do_partial_recognition:
            has_partial, partial_result_tok = self.htr_session.decodePartially()
            if has_partial:
              partial_result, partial_result_seg = tokenizer.postprocess(partial_result_tok)
              self.emit('htrupdate', partial_result, partial_result_seg)

    @event
    def end_htr_session(self):
      if self.htr_session: 
          result_tok = self.htr_session.decode()
          print >> sys.stderr, result_tok
          result, result_seg = tokenizer.postprocess(result_tok)
          self.emit('htrchange', result, result_seg)
          htr.deleteSession(self.htr_session)
          self.htr_session = None
          dump_strokes(self.strokes)
          self.strokes = None

#class LoggerConnection(SocketConnection, Logger):
    @event
    def on_open(self, info):
      print >> sys.stderr, "Connection Info", repr(info.__dict__)
      MyLogger.participants.add(self)
      self.htr_session = None

    @event
    def on_close(self):
      if self.htr_session: 
        htr.deleteSession(self.htr_session)
      MyLogger.participants.remove(self)


class RouterConnection(SocketConnection):
    __endpoints__ = {
                     '/casmacat': HtrConnection
                     }

    def on_open(self, info):
        print 'Router', repr(info)


# Create tornadio router
CasmacatRouter = TornadioRouter(RouterConnection)

# Create socket application
application = web.Application(
    CasmacatRouter.apply_routes([]),
    flash_policy_port = 843,
    flash_policy_file = os.path.join(ROOT, 'flashpolicy.xml'),
    socket_io_port = 3020
)

if __name__ == "__main__":
    from sys import argv
    import logging
    logging.getLogger().setLevel(logging.INFO)


    
    tokenizer_plugin = TextProcessorPlugin("plugins/space-tokenizer.so")
    tokenizer_factory = tokenizer_plugin.create()
    if not tokenizer_factory: raise Exception("Tokenizer plugin failed")
    tokenizer_factory.setLogger(logger)
    tokenizer = tokenizer_factory.createInstance()
    if not tokenizer: raise Exception("Tokenizer instance failed")
    
    htr_plugin = HtrPlugin("plugins/iatros-plugin.so", "-c plugins/xerox.plugin.conf")
    htr_factory = htr_plugin.create()
    if not htr_factory: raise Exception("HTR plugin failed")
    htr_factory.setLogger(logger)
    htr = htr_factory.createInstance()
    if not htr: raise Exception("HTR instance failed")

    # Create and start tornadio server
    SocketServer(application)

    del tokenizer, tokenizer_factory, tokenizer_plugin 
    del htr, htr_factory, htr_plugin
