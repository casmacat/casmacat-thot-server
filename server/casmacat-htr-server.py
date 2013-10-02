#! /usr/bin/env python
# -*- coding: utf-8 -*-

import sys, traceback, os
import datetime, time
import random, math, codecs, collections

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

def convert(data):
    if isinstance(data, unicode):
        return filter_utf8(data)
    elif isinstance(data, basestring):
        return data
    elif isinstance(data, collections.Mapping):
        return dict(map(convert, data.iteritems()))
    elif isinstance(data, collections.Iterable):
        return type(data)(map(convert, data))
    else:
        return data

def to_utf8(obj):
  return convert(obj)
#def to_utf8(obj):
#  if obj == None:
#    return obj
#  elif isinstance(obj, basestring):
#    return filter_utf8(obj)
#  elif isinstance(obj, list): 
#    return [to_utf8(w) for w in obj]
#  print "Unknown type", type(obj), "for object", obj
#  raise "Unknown type"


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
        models.htr.deleteSession(self.htr_session)
        self.htr_session = None
        self.strokes = None

      logger.log(DEBUG_LOG, str(caret_pos) + " @ " + target);

      source_tok, source_seg = models.tokenizer.preprocess(source)
      print >> sys.stderr, "source", source

      prefix = target[:caret_pos] 
      prefix_tok, prefix_seg = models.tokenizer.preprocess(prefix)
      print >> sys.stderr, "prefix", prefix

      suffix = target[caret_pos:] 
      suffix_tok, suffix_seg = models.tokenizer.preprocess(suffix)
      print >> sys.stderr, "suffix", suffix 

      last_token_is_partial = False
      if len(suffix) != 0 and not suffix[0].isspace():
        last_token_is_partial = True
      print >> sys.stderr, "last_token_is_partial", last_token_is_partial 

      start_time = datetime.datetime.now()
      #self.htr_session = models.htr.createSessionFromPrefix(source_tok, prefix_tok, suffix_tok, last_token_is_partial)
      self.htr_session = models.htr.createSessionFromPrefix([], [], [], False)
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
              partial_result, partial_result_seg = models.tokenizer.postprocess(partial_result_tok)
              print >> sys.stderr, "update", partial_result_tok

              obj = { 'nbest': [{ 
                        'text': partial_result, 
                        'textSegmentation': partial_result_seg,
                        'elapsedTime': elapsed_time.total_seconds()*1000.0
                      }], 
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
          result, result_seg = models.tokenizer.postprocess(result_tok)

          obj = { 'nbest': [{ 
                    'text': result, 
                    'textSegmentation': result_seg,
                    'elapsedTime': elapsed_time.total_seconds()*1000.0
                  }], 
                  'elapsedTime': elapsed_time.total_seconds()*1000.0
                }

          self.respond('endSessionResult', { 'errors': [], 'data': obj })


          models.htr.deleteSession(self.htr_session)
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
        models.htr.deleteSession(self.htr_session)
      MyLogger.participants.remove(self)


class RouterConnection(SocketConnection):
    __endpoints__ = {
                     '/casmacat': HtrConnection
                     }

    def on_open(self, info):
        print 'Router', repr(info)




class Models:
  def __init__(self, config_fn):
    self.config = to_utf8(json.load(open(config_fn)))
    print >> sys.stderr, "config", json.dumps(self.config)
 
  @timer('create_plugins')
  def create_plugins(self):
    start_time = datetime.datetime.now()
    params = self.config["text-processor"]["parameters"] if "parameters" in self.config["text-processor"] else "" 
    self.tokenizer_plugin = TextProcessorPlugin(self.config["text-processor"]["module"], params)
    self.tokenizer_factory = self.tokenizer_plugin.create()
    if not self.tokenizer_factory: raise Exception("Tokenizer plugin failed")
    self.tokenizer_factory.setLogger(logger)
    self.tokenizer = self.tokenizer_factory.createInstance()
    if not self.tokenizer: raise Exception("Tokenizer instance failed")
    elapsed_time = datetime.datetime.now() - start_time
    print "TIME:%s loaded:%s" % ("tokenizer", fmt_delta(elapsed_time))

    start_time = datetime.datetime.now()
    params = self.config["htr"]["parameters"] if "parameters" in self.config["htr"] else "" 
    self.htr_plugin = HtrPlugin(self.config["htr"]["module"], params)
    self.htr_factory = self.htr_plugin.create()
    if not self.htr_factory: raise Exception("htr plugin failed")
    self.htr_factory.setLogger(logger)
    self.htr = self.htr_factory.createInstance()
    if not self.htr: raise Exception("htr instance failed")
    elapsed_time = datetime.datetime.now() - start_time
    print "TIME:%s loaded:%s" % ("htr", fmt_delta(elapsed_time))

  @timer('delete_plugins')
  def delete_plugins(self):
    self.tokenizer_factory.deleteInstance(self.tokenizer);
    self.tokenizer_plugin.destroy(self.tokenizer_factory)
    self.tokenizer, self.tokenizer_factory = None, None
    del self.tokenizer_plugin
  
    self.htr_factory.deleteInstance(self.htr);
    self.htr_plugin.destroy(self.htr_factory)
    self.htr, self.htr_factory = None, None
    del self.htr_plugin
  


# Create tornadio router
CasmacatRouter = TornadioRouter(RouterConnection)


if __name__ == "__main__":
    from sys import argv
    import logging
    import atexit
    import getopt 

    try:
      opts, args = getopt.getopt(sys.argv[1:], "hl:c:", ["help", "logfile=", "config="])
    except getopt.GetoptError as err:
      # print help information and exit:
      print >> sys.stderr, str(err) # will print something like "option -a not recognized"
      usage()
      sys.exit(2)
    log_fn = None
    config_fn = None
    for o, a in opts:
      if o == "-v":
        verbose = True
      elif o in ("-c", "--config"):
        config_fn = a
      elif o in ("-l", "--logfile"):
        log_fn = a
      else:
        assert False, "unhandled option"

    if not log_fn:
      try:
        log_fn = models.config["server"]["logfile"]
      except:
        pass
    if log_fn:
      logfd = codecs.open(log_fn, "a", "utf-8")
    else:
      logfd = codecs.open(os.path.devnull, "a", "utf-8")

    logging.getLogger().setLevel(logging.INFO)

    models = Models(config_fn)
    models.create_plugins()
    atexit.register(models.delete_plugins)

    port = 5002
    try: 
      port = int(sys.argv[0])
    except:
      try:
        port = models.config["server"]["port"]
      except:
        pass

    # Create socket application
    application = web.Application(
        CasmacatRouter.apply_routes([]),
        flash_policy_port = 843,
        flash_policy_file = os.path.join(ROOT, 'flashpolicy.xml'),
        socket_io_port = port 
    )

    print >> logfd, """/*\n  Casmacat HTR server started on port %d\n  %s\n*/\n\n"config": %s\n\n\n""" % (port, str(datetime.datetime.now()), json.dumps(models.config, indent=2, separators=(',', ': '), encoding="utf-8"))

    # Create and start tornadio server
    SocketServer(application)
