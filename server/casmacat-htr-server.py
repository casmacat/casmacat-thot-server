#! /usr/bin/env python
# -*- coding: utf-8 -*-

import sys, traceback, os
import datetime, time
import random, math, codecs

try: import simplejson as json
except ImportError: import json

from tornado import web
from tornadio2 import SocketConnection, TornadioRouter, SocketServer, event

from casmacat import *
#from numpy.testing.utils import elapsed


do_partial_recognition = True

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
    for x, y, _ in points:
      print >> out, int(round(x)), int(round(y))
  out.close()


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

      print >> logfd, """/*\n  Server method "%s" invoked\n  %s\n*/\n\n"%s": %s\n""" % (self.name, str(datetime.datetime.now()), self.name, json.dumps(kwargs, indent=2, separators=(',', ': '), encoding="utf-8"))

      ret = function(*args, **kwargs)
      elapsed_time = datetime.datetime.now() - start_time
      print "TIME:%s:%s" % (self.name, fmt_delta(elapsed_time))
      print >> logfd, """/* Time to process method "%s": %s */\n\n\n""" % (self.name, fmt_delta(elapsed_time))
      return ret
    return decorator



# decorator to capture exceptions and return them as errors in json
class thrower(object):
  def __init__(self, emission):
    """
    If there are decorator arguments, the function
    to be decorated is not passed to the constructor!
    """
    self.emission = emission

  def __call__(self, function):
    """
    If there are decorator arguments, __call__() is only called
    once, as part of the decoration process! You can only give
    it a single argument, which is the function object.
    """
    def decorator(*args, **kwargs):
      try:
        return function(*args, **kwargs)
      except Exception, e:
        if self.emission:
          args[0].respond(self.emission, { 'function': self.emission, 'errors': [traceback.format_exc()], 'data': None })
        print traceback.format_exc()
        #raise
    return decorator


logfd = None

class MyLogger(Logger):
  tag = { ERROR_LOG: "ERROR", WARN_LOG: "WARN", INFO_LOG: "INFO", DEBUG_LOG: "DEBUG" }
  participants = set()

  def log(self, type, msg):
    return
    if type in self.tag:
      msg = "%s: %s" % (self.tag[type], msg)
    else: 
      msg = "LOG: %s" % msg
    for p in self.participants:
      p.respond('receive_log', msg)
    
logger = MyLogger()

ROOT = os.path.normpath(os.path.dirname(__file__))

def filter_utf8(string):
  return string.encode('utf-8')

def to_utf8(obj):
  if obj == None:
    return obj
  elif isinstance(obj, basestring):
    return filter_utf8(obj)
  elif isinstance(obj, list): 
    return [to_utf8(w) for w in obj]
  print "Unknown type", type(obj), "for object", obj
  raise "Unknown type"


class HtrConnection(SocketConnection):
    def respond(self, *args, **kwargs):
      print "emit", args, kwargs
      print >> logfd, """/*\n  Server response "%s"\n  %s\n*/\n\n"%s": %s\n""" % (args[0], str(datetime.datetime.now()), args[0], json.dumps(args[1:], indent=2, separators=(',', ': '), encoding="utf-8"))
      self.emit(*args, **kwargs)

    @event('startSession')
    @timer('startSession')
    @thrower('startSessionResult')
    def startHtrSession(self, data):
      source, target = to_utf8(data['source']), to_utf8(data['target'])
      caret_pos = data['caretPos']
      if self.htr_session: 
        htr.deleteSession(self.htr_session)
        self.htr_session = None
        self.strokes = None

      logger.log(DEBUG_LOG, str(caret_pos) + " @ " + target);

      source_tok, source_seg = tokenizer.preprocess(source)
      print >> sys.stderr, "source", source

      prefix = target[:caret_pos] 
      prefix_tok, prefix_seg = tokenizer.preprocess(prefix)
      print >> sys.stderr, "prefix", prefix

      suffix = target[caret_pos:] 
      suffix_tok, suffix_seg = tokenizer.preprocess(suffix)
      print >> sys.stderr, "suffix", suffix 

      last_token_is_partial = False
      if len(suffix) != 0 and not suffix[0].isspace():
        last_token_is_partial = True
      print >> sys.stderr, "last_token_is_partial", last_token_is_partial 

      start_time = datetime.datetime.now()
      #self.htr_session = htr.createSessionFromPrefix(source_tok, prefix_tok, suffix_tok, last_token_is_partial)
      self.htr_session = htr.createSessionFromPrefix([], [], [], False)
      self.strokes = []
      elapsed_time = datetime.datetime.now() - start_time
      obj = { 'elapsedTime': elapsed_time.total_seconds()*1000.0 }
      self.respond('startSessionResult', { 'errors': [], 'data': obj })


    @event('addStroke')
    @timer('addStroke')
    @thrower('addStrokeResult')
    def addStroke(self, data):
      points, is_pen_down = data['points'], True
      if self.htr_session:
        self.strokes.append((points, is_pen_down)) 
        for x, y, _ in points:
            self.htr_session.addPoint(x, y, True)
        self.htr_session.addPoint(0, 0, False)
        
        obj = { 'elapsedTime': 0 }
        if do_partial_recognition:
            start_time = datetime.datetime.now()
            has_partial, partial_result_tok = self.htr_session.decodePartially()
            elapsed_time = datetime.datetime.now() - start_time
            if has_partial:
              partial_result, partial_result_seg = tokenizer.postprocess(partial_result_tok)
              print >> sys.stderr, "update", partial_result_tok

              obj = { 'nbest': { 
                        'text': partial_result, 
                        'textSegmentation': partial_result_seg,
                        'elapsedTime': elapsed_time.total_seconds()*1000.0
                      }, 
                      'elapsedTime': elapsed_time.total_seconds()*1000.0
                    }

        self.respond('addStrokeResult', { 'errors': [], 'data': obj })
      else: 
        self.respond('addStrokeResult', { 'errors': [ 'HTR session not started' ], 'data': None })


    @event('endSession')
    @timer('endSession')
    @thrower('endSessionResult')
    def endSession(self):
      if self.htr_session: 
          start_time = datetime.datetime.now()
          result_tok = self.htr_session.decode()
          elapsed_time = datetime.datetime.now() - start_time
          print >> sys.stderr, "change", result_tok
          result, result_seg = tokenizer.postprocess(result_tok)

          obj = { 'nbest': { 
                    'text': result, 
                    'textSegmentation': result_seg,
                    'elapsedTime': elapsed_time.total_seconds()*1000.0
                  }, 
                  'elapsedTime': elapsed_time.total_seconds()*1000.0
                }

          self.respond('endSessionResult', { 'errors': [], 'data': obj })


          htr.deleteSession(self.htr_session)
          self.htr_session = None
          dump_strokes(self.strokes)
          self.strokes = None


    @event('configure')
    @timer('configure')
    @thrower('configureResult')
    def configure(self, data):
      self.config = data
      print >> sys.stderr, self.config 
      self.respond('configureResult', { 'errors': [], 'data': data })


#class LoggerConnection(SocketConnection, Logger):
    @event
    def on_open(self, info):
      print >> sys.stderr, "Connection Info", repr(info.__dict__)
      MyLogger.participants.add(self)
      self.htr_session = None
      self.config = { 'suggestions': False, 'mode': u'PE' }

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

if __name__ == "__main__":
    from sys import argv
    import logging
    import atexit

    logfn = "casmacat-htr-server.log"
    try: 
      logfn = models.config["server"]["logfile"]
    except:
      pass
    logfd = codecs.open(logfn, "a", "utf-8")


    logging.getLogger().setLevel(logging.INFO)


    
    tokenizer_plugin = TextProcessorPlugin("plugins/space-tokenizer.so")
    tokenizer_factory = tokenizer_plugin.create()
    if not tokenizer_factory: raise Exception("Tokenizer plugin failed")
    tokenizer_factory.setLogger(logger)
    tokenizer = tokenizer_factory.createInstance()
    if not tokenizer: raise Exception("Tokenizer instance failed")
    
    htr_plugin = HtrPlugin("plugins/iatros-plugin.so", "-c /home/demo/software/casmacat-server-library/server/htr-models/casmacat/casmacat.conf")
    htr_factory = htr_plugin.create()
    if not htr_factory: raise Exception("HTR plugin failed")
    htr_factory.setLogger(logger)
    htr = htr_factory.createInstance()
    if not htr: raise Exception("HTR instance failed")

    # Create socket application
    application = web.Application(
        CasmacatRouter.apply_routes([]),
        flash_policy_port = 843,
        flash_policy_file = os.path.join(ROOT, 'flashpolicy.xml'),
        socket_io_port = 7001
    )

    # Create and start tornadio server
    SocketServer(application)

    del tokenizer, tokenizer_factory, tokenizer_plugin 
    del htr, htr_factory, htr_plugin
