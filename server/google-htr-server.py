#! /usr/bin/env python
# -*- coding: utf-8 -*-

import sys, traceback, os
import datetime, time
import random, math, codecs
import urllib2
import copy, collections

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

def extend(d1, d2):
  for k, v in d2.iteritems():
    if k not in d1 or not isinstance(d1[k], dict):
      d1[k] = v
    else:
      extend(d1[k], v)

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

      self.pre_context = prefix
      self.partial_result = ""
      self.last_result = None
      self.last_submit = None

      start_time = datetime.datetime.now()
      self.strokes = []
      self.ink = []
      elapsed_time = datetime.datetime.now() - start_time
      obj = { 'elapsedTime': elapsed_time.total_seconds()*1000.0 }
      self.respond('startSessionResult', { 'errors': [], 'data': obj })


    def decode(self):
      data = {
               'device':   self.config['device'],
               'options':  self.config['options'],
               'requests': [{
                 'writing_guide': {
                   'writing_area_width':  self.config['canvasSize']['width'],
                   'writing_area_height': self.config['canvasSize']['height']
                 },
                 'pre_context': self.pre_context,
                 'ink': self.ink,
                 'language': self.config['language']
               }]
             }
      
      print 'DATA', json.dumps(data)

      start_time = datetime.datetime.now()
      # POST json data to Google
      req = urllib2.Request(self.config['url'], json.dumps(data), {'Content-Type': 'application/json'})
      f = urllib2.urlopen(req)
      response = json.loads(f.read())
      f.close()
      elapsed_time = datetime.datetime.now() - start_time

      print 'RESPONSE', response
      if response[0] == "SUCCESS":
        #self.pre_context    += response[1][0][1][0] 
        obj = { 
                'nbest': [],
                'elapsedTime': elapsed_time.total_seconds()*1000.0
              }

        self.partial_result = response[1][0][1][0] 
        for res in response[1][0][1]:
          if res != "":
            print "RES", res 
            partial_result_tok, partial_result_seg = models.tokenizer.preprocess(res)
            print >> sys.stderr, "partial response", partial_result_tok
            obj['nbest'].append({
                  'text': res, 
                  'textSegmentation': partial_result_seg
            })

        self.last_result = { 'errors': [], 'data': obj } 
        return self.last_result 

      else:
        return { 'errors': [response[0]], 'data': {'elapsedTime': elapsed_time.total_seconds()*1000.0} }


    @event('addStroke')
    @timer('addStroke')
    @thrower('addStrokeResult')
    def addStroke(self, data):
      points, is_pen_down = data['points'], True
      self.strokes.append((points, is_pen_down)) 

      self.ink.append([[], [], []])
      for p in points: 
        self.ink[-1][0].append(p[0]);
        self.ink[-1][1].append(p[1]);
        self.ink[-1][2].append(p[2] - points[-1][2]);

      time_lapse = 200000
      if self.last_submit > 0:
        time1 = self.strokes[self.last_submit - 1][0][-1][2]
        time2 = self.strokes[-1][0][0][2]
        print >> sys.stderr, "LAPSE", time1, time2, time1 + time_lapse
      if not self.last_submit or time2 > time1 + time_lapse:
        response = self.decode()
        self.last_submit = len(self.strokes)

        self.respond('addStrokeResult', response)

    @event('endSession')
    @timer('endSession')
    @thrower('endSessionResult')
    def endSession(self):
      if self.last_submit < len(self.ink): 
        response = self.decode()
      else:
        response = self.last_result
        response['data']['elapsedTime'] = 0

      self.respond('endSessionResult', response)

      dump_strokes(self.strokes)
      self.strokes = None
      self.ink = None
      self.prefix = None
      self.last_result = None
      self.last_submit = None


    @event('configure')
    @timer('configure')
    @thrower('configureResult')
    def configure(self, data):
      extend(self.config, to_utf8(data))
      print >> sys.stderr, 'configure', self.config 
      self.respond('configureResult', { 'errors': [], 'data': self.config })


#class LoggerConnection(SocketConnection, Logger):
    @event
    def on_open(self, info):
      print >> sys.stderr, "Connection Info", repr(self), repr(info.__dict__)
      if 'config' not in self.__dict__:
        MyLogger.participants.add(self)
        self.config = copy.deepcopy(models.config['htr'])
      else:
        print >> sys.stderr, "Reusing connection"

    @event
    def on_close(self):
      MyLogger.participants.remove(self)
      del self.config
      print >> sys.stderr, "Disconnection Info", repr(self)


class Models:
  def __init__(self, config_fn):
    self.config = to_utf8(json.load(open(config_fn)))
    print >> sys.stderr, "config", json.dumps(self.config)
 
  @timer('create_plugins')
  def create_plugins(self):
    start_time = datetime.datetime.now()
    self.tokenizer_plugin = TextProcessorPlugin(self.config["text-processor"]["module"], self.config["text-processor"]["parameters"])
    self.tokenizer_factory = self.tokenizer_plugin.create()
    if not self.tokenizer_factory: raise Exception("Tokenizer plugin failed")
    self.tokenizer_factory.setLogger(logger)
    self.tokenizer = self.tokenizer_factory.createInstance()
    if not self.tokenizer: raise Exception("Tokenizer instance failed")
    elapsed_time = datetime.datetime.now() - start_time
    print "TIME:%s loaded:%s" % ("tokenizer", fmt_delta(elapsed_time))

  @timer('delete_plugins')
  def delete_plugins(self):
    self.tokenizer_factory.deleteInstance(self.tokenizer);
    self.tokenizer_plugin.destroy(self.tokenizer_factory)
    self.tokenizer, self.tokenizer_factory = None, None
    del self.tokenizer_plugin
  

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

    models = Models(sys.argv[1])
    models.create_plugins()
    atexit.register(models.delete_plugins)

    logfn = "google-htr-server.log"
    try: 
      logfn = models.config["server"]["logfile"]
    except:
      pass
    logfd = codecs.open(logfn, "a", "utf-8")


    logging.getLogger().setLevel(logging.INFO)


    port = 3003
    try: 
      port = int(sys.argv[2])
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

    print >> logfd, """/*\n  Casmacat server started on port %d\n  %s\n*/\n\n"config": %s\n\n\n""" % (port, str(datetime.datetime.now()), json.dumps(models.config, indent=2, separators=(',', ': '), encoding="utf-8"))

    # Create and start tornadio server
    SocketServer(application)
