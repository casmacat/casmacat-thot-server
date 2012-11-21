#! /usr/bin/env python
# -*- coding: utf-8 -*-

import sys, traceback, os
import datetime, time
import random


from tornado import web
from tornadio2 import SocketConnection, TornadioRouter, SocketServer, event

from casmacat import *


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
        print function.__dict__
        return function(*args, **kwargs)
      except Exception, e:
        if self.emission:
          args[0].emit(self.emission, { 'errors': [traceback.format_exc()], 'data': None })
        print traceback.format_exc()
        #raise
    return decorator




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

def new_match(created_by, source, source_seg, target, target_seg):
  match = {}
  match['id'] = random.randint(0,100000)
  match['segment'] = source 
  match['segmentTokens'] = source_seg
  match['translation'] = target
  match['translationTokens'] = target_seg
  match['raw_translation'] = target
  match['quality'] = 75
  if created_by == 'OL':
    match['quality'] = 70
  match['created_by'] = created_by
  match['create_date'] = datetime.datetime.now().strftime('%y-%m-%d %H:%M:%S')
  match['last_update_by'] = "me!" 
  match['last_update_date'] = match['create_date'] 
  match['match'] = 85
  match['reference'] = source 
  match['usage_count'] = 1
  match['subject'] = "Printer Manuals"
  return match

def new_prediction(created_by, prediction, prediction_seg):
  match = {}
  match['id'] = random.randint(0,100000)
  match['translation'] = prediction
  match['translationTokens'] = prediction_seg
  match['quality'] = 75
  if created_by == 'OL':
    match['quality'] = 70
  match['created_by'] = created_by
  match['create_date'] = datetime.datetime.now().strftime('%y-%m-%d %H:%M:%S')
  match['last_update_by'] = "me!" 
  match['last_update_date'] = datetime.datetime.now().strftime('%y-%m-%d %H:%M:%S') 
  match['match'] = 85
  match['usage_count'] = 1
  match['subject'] = "Printer Manuals"
  return match

def new_contributions(source, source_seg):
  data = {}
  data['text'] = source
  data['textTokens'] = source_seg
  data['matches'] = []
  return { 'errors': [], 'data': data }

def new_predictions(target, caret_pos):
  data = {}
  data['previousText'] = target 
  data['caretPos'] = caret_pos 
  data['matches'] = []
  return { 'errors': [], 'data': data }

def add_match(obj, match):
  obj['data']['matches'].append(match)

def prepare(obj):
  if len(obj['data']['matches']) > 0:
    obj['data']['matches'].sort(key=lambda match: match['quality'], reverse=True)
    print obj['data']['matches']
    obj['data']['translatedText'] = obj['data']['matches'][0]['translation']
    obj['data']['translatedTextTokens'] = obj['data']['matches'][0]['translationTokens']


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


class IndexHandler(web.RequestHandler):
    """Regular HTTP handler to serve files"""
    def get(self):
        self.render("index.html")

class CssHandler(web.RequestHandler):
    """Regular HTTP handler to serve files"""
    def get(self, filename):
        self.render(os.path.join("css", filename))

class JsHandler(web.RequestHandler):
    """Regular HTTP handler to serve files"""
    def get(self, filename):
        self.render(os.path.join("js", filename))

class ExampleHandler(web.RequestHandler):
    """Regular HTTP handler to serve files"""
    def get(self, filename):
        self.render(os.path.join("examples", filename))


class CasmacatConnection(SocketConnection):
#class AlignerConnection(SocketConnection):
    @event('get_alignments')
    @thrower('alignmentchange')
    def get_alignments(self, data):
      print 'data:', data
      source, target = to_utf8(data['text']), to_utf8(data['target'])
      source_tok, source_seg = models.tokenizer.preprocess(source)
      target_tok, target_seg = models.tokenizer.preprocess(target)
      matrix = models.aligner.align(source_tok, target_tok)
      logger.log(DEBUG_LOG, matrix);
      obj = { 'matrix': matrix, 
              'source': source, 
              'source_seg': source_seg, 
              'target': target, 
              'target_seg': target_seg 
            }
      self.emit('alignmentchange', { 'errors': [], 'data': obj })

#class ProcessorConnection(SocketConnection):
    @event('get_tokens')
    @thrower('translationchange')
    def get_tokens(self, data):
      print 'data:', data
      source, target = to_utf8(data['text']), to_utf8(data['target'])
      source_tok, source_seg = models.tokenizer.preprocess(source)
      target_tok, target_seg = models.tokenizer.preprocess(target)

      contributions = new_contributions(source, source_seg)
      add_match(contributions, new_match('tokenizer', source, source_seg, target, target_seg))

      prepare(contributions)
      self.emit('translationchange', contributions)


#class WordConfidenceConnection(SocketConnection):
#    @event
#    def get_translation_confidence(self, source, target, validated_words):
#      source, target = to_utf8(source), to_utf8(target)
#      source_tok, source_seg = tokenizer.preprocess(source)
#      target_tok, target_seg = tokenizer.preprocess(target)
#      conf = confidencer.getSentenceConfidence(source_tok, target_tok, validated_words)
#      self.emit('confidencechange', conf, source, source_seg, target, target_seg)

    @event('get_word_confidences')
    @thrower('confidencechange')
    def get_word_confidences(self, data):
      print 'data:', data
      source, target = to_utf8(data['text']), to_utf8(data['target'])
      source_tok, source_seg = models.tokenizer.preprocess(source)
      target_tok, target_seg = models.tokenizer.preprocess(target)
      sent, conf = models.confidencer.getWordConfidences(source_tok, target_tok, data['validated_words'])

      obj = { 'quality': sent, 
        'word_confidences': conf, 
        'source': source, 
        'source_seg': source_seg, 
        'target': target, 
        'target_seg': target_seg 
      }
      print 'confidences:', obj
      self.emit('confidencechange', { 'errors': [], 'data': obj })

#class MtConnection(SocketConnection):
# receives:
#  data: {
#    "action": "getContribution",
#    "id_segment": 607906,
#    "text": "Title",
#    "id_job": 1135,
#    "num_results": 2,
#    "id_translator": ""
#  }
#
# sends:
#{
#  "errors": [],
#  "data": {
#    "matches": [{
#      "id": "22300943",
#      "segment": "Path:",
#      "translation": "Chemin :",
#      "raw_translation": "Chemin :",
#      "quality": "74",
#      "reference": "",
#      "usage_count": 60,
#      "subject": "Computer_Science",
#      "created_by": "TRANSLATED",
#      "last_updated_by": null,
#      "create_date": "0000-00-00 00:00:00",
#      "last_update_date": "0000-00-00",
#      "match": "99%"
#    }, {
#      "id": "5210478",
#      "segment": "&amp;Path",
#      "translation": "&amp;Chemin d'acc\u00e8s",
#      "raw_translation": "&amp;Chemin d'acc&Atilde;&uml;s",
#      "quality": "0",
#      "reference": "",
#      "usage_count": 2,
#      "subject": "Computer_Science",
#      "created_by": "Anonymous",
#      "last_updated_by": null,
#      "create_date": "2006-10-31 18:21:55",
#      "last_update_date": "2006-10-31",
#      "match": "98%"
#    }]
#  }
#}
    @event('translate')
    @thrower('contributionchange')
    def translate(self, data):
      print 'data:', data
      source = to_utf8(data['text'])
      source_tok, source_seg = models.tokenizer.preprocess(source)
      contributions = new_contributions(source, source_seg)

      for name, mt in models.mt_systems.iteritems():
        target_tok = mt.translate(source_tok)
        target, target_seg = models.tokenizer.postprocess(target_tok)
        add_match(contributions, new_match(name, source, source_seg, target, target_seg))

      prepare(contributions)
      self.emit('contributionchange', contributions)

    @event
    def update(self, data):
      source = to_utf8(data['text'])
      source_tok, source_seg = models.tokenizer.preprocess(source)
      target = to_utf8(data['target'])
      target_tok, target_seg = models.tokenizer.preprocess(target)
      for name, ol in models.ol_systems.iteritems():
        ol.update(source_tok, target_tok)

#class ImtConnection(SocketConnection):
    @event
    def start_imt_session(self, data):
      print 'data:', data
      source = to_utf8(data['text'])
      for name, session in self.imt_session.iteritems():
          models.imt_systems[name].deleteSession(session)
      self.imt_session = {} 

      source_tok, source_seg = models.tokenizer.preprocess(source)
      logger.log(DEBUG_LOG, "starting imt session with " + str(source_tok));
      for name, imt in models.imt_systems.iteritems():
        self.imt_session[name] = imt.newSession(source_tok)
        
    @event('set_prefix')
    @thrower('predictionchange')
    def set_prefix(self, data):
      print 'data:', data
      target = data['target']
      caret_pos = data['caret_pos']

      logger.log(DEBUG_LOG, str(caret_pos) + " @ " + to_utf8(target))

      prefix = to_utf8(target[:caret_pos]) 
      suffix = to_utf8(target[caret_pos:]) 

      print >> sys.stderr, "prefix '%s'" % prefix, type(prefix)
      print >> sys.stderr, "suffix '%s'" % suffix, type(suffix) 

      prefix_tok, prefix_seg = models.tokenizer.preprocess(prefix)
      suffix_tok, suffix_seg = models.tokenizer.preprocess(suffix)

      last_token_is_partial = True
      if len(prefix) == 0 or prefix[-1].isspace():
        last_token_is_partial = False
      print >> sys.stderr, "last_token_is_partial", last_token_is_partial 

      predictions = new_predictions(target, caret_pos)
      
      for name, session in self.imt_session.iteritems():
        prediction_tok = session.setPrefix(prefix_tok, suffix_tok, last_token_is_partial)
        print >> sys.stderr, name, "prediction_tok", prediction_tok 

        #if last_token_is_partial:
        #  target_tok = list(prefix_tok[:-1]) + [prefix_tok[-1] + prediction_tok[0]] + list(prediction_tok[1:])
        #else:
        #  target_tok = list(prefix_tok) + list(prediction_tok)
        #
        #target, target_seg = tokenizer.postprocess(target_tok)
        #add_match(predictions, new_prediction(name, target, target_seg))

        prediction, prediction_seg = models.tokenizer.postprocess(prediction_tok)
        add_match(predictions, new_prediction(name, prediction, prediction_seg))
      prepare(predictions)
      self.emit('predictionchange', predictions)

    @event
    def end_imt_session(self):
      for name, session in self.imt_session.iteritems():
          models.imt_systems[name].deleteSession(session)
      self.imt_session = {} 
      logger.log(DEBUG_LOG, "ending imt session");

    @event
    def reset(self):
      models.reset()
      self.emit('serverready', 'the server is ready')

#class LoggerConnection(SocketConnection, Logger):
    @event
    def on_open(self, info):
      print >> sys.stderr, "Connection Info", repr(info.__dict__)
      MyLogger.participants.add(self)
      self.imt_session = {} 

    @event
    def on_close(self):
      MyLogger.participants.remove(self)


class RouterConnection(SocketConnection):
    __endpoints__ = {#'/mt': MtConnection,
                     #'/aligner': AlignerConnection,
                     #'/word_confidence': WordConfidenceConnection,
                     #'/logger': LoggerConnection
                     '/casmacat': CasmacatConnection
                     }

    def on_open(self, info):
        print 'Router', repr(info)


# Create tornadio router
CasmacatRouter = TornadioRouter(RouterConnection)

# Create socket application
application = web.Application(
    CasmacatRouter.apply_routes([
                                  (r"/", IndexHandler), 
                                  (r"/js/(.*)", JsHandler),
                                  (r"/css/(.*)", CssHandler),
                                  (r"/examples/(.*)", ExampleHandler)
                                ]),
    flash_policy_port = 843,
    flash_policy_file = os.path.join(ROOT, 'flashpolicy.xml'),
    socket_io_port = 3019
)

class Models:
  def __init__(self):
    self.mt_systems = {}
    self.imt_systems = {}
    self.ol_systems = {}
  
  def assign_models(self):
    self.mt_systems["ITP"] = self.static_mt
    self.imt_systems["ITP"] = self.static_mt

    self.mt_systems["ITP-OL"] = self.online_mt
    self.imt_systems["ITP-OL"] = self.online_mt
    self.ol_systems["ITP-OL"] = self.online_mt
    
    self.ol_systems["ALIGNER"] = self.aligner
    self.ol_systems["CONFIDENCER"] = self.confidencer

    
  def create_plugins(self):
    self.tokenizer_plugin = TextProcessorPlugin("plugins/space-tokenizer.so")
    self.tokenizer_factory = self.tokenizer_plugin.create()
    if not self.tokenizer_factory: raise Exception("Tokenizer plugin failed")
    self.tokenizer_factory.setLogger(logger)
    self.tokenizer = self.tokenizer_factory.createInstance()
    if not self.tokenizer: raise Exception("Tokenizer instance failed")

    
#    mt_plugin = MtPlugin("plugins/moses-mt-engine.so", "-f xerox.models/model/moses.ini")
    self.mt_plugin = ImtPlugin("plugins/libstack_dec.so", "-c /home/dortiz/smt/software/stack_dec/aux_dirs/cfg_files/casmacat_xerox_enes_adapt_wg.cfg", "thot_imt_plugin")

    self.mt_factory = self.mt_plugin.create()
    if not self.mt_factory: raise Exception("MT plugin failed")
    self.mt_factory.setLogger(logger)
    self.static_mt = self.mt_factory.createInstance()
    if not self.static_mt: raise Exception("Static MT instance failed")

    self.ol_factory = self.mt_plugin.create()
    if not self.ol_factory: raise Exception("Online MT plugin failed")
    self.ol_factory.setLogger(logger)
    self.online_mt = self.ol_factory.createInstance()
    if not self.online_mt: raise Exception("Online MT instance failed")

    self.alignment_plugin = AlignmentPlugin("plugins/HMMaligner.so", "/home/dortiz/smt/tasks/Xerox/en_es/v14may2003/my_simplified3/CASMACAT_INVTM/my_ef_invswm")
    self.alignment_factory = self.alignment_plugin.create()
    if not self.alignment_factory: raise Exception("Alignment plugin failed")
    self.alignment_factory.setLogger(logger)
    self.aligner = self.alignment_factory.createInstance()
    if not self.aligner: raise Exception("Aligner instance failed")

    
    self.confidence_plugin = ConfidencePlugin("plugins/ibmMax-confidence-estimator.so", "/home/dortiz/smt/tasks/Xerox/en_es/v14may2003/my_simplified3/CASMACAT_INVTM/my_ef_invswm")
    self.confidence_factory = self.confidence_plugin.create()
    if not self.confidence_factory: raise Exception("Confidence plugin failed")
    self.confidence_factory.setLogger(logger)
    self.confidencer = self.confidence_factory.createInstance()
    if not self.confidencer: raise Exception("Confidencer instance failed")

    self.assign_models()    
    print >> sys.stderr, "Plugins loaded"
  
  
  def delete_plugins(self):
    self.confidence_factory.deleteInstance(self.confidencer);
    self.confidence_plugin.destroy(self.confidence_factory)
    self.confidencer, self.confidence_factory = None, None
    del self.confidence_plugin

    self.alignment_factory.deleteInstance(self.aligner);
    self.alignment_plugin.destroy(self.alignment_factory)
    self.aligner, self.alignment_factory = None, None
    del self.alignment_plugin
    
    self.mt_factory.deleteInstance(self.static_mt);
    self.mt_plugin.destroy(self.mt_factory)
    self.static_mt, self.mt_factory = None, None

    self.ol_factory.deleteInstance(self.online_mt);
    self.ol_plugin.destroy(self.ol_factory)
    self.online_mt, self.ol_factory = None, None
    
    del self.mt_plugin

    self.tokenizer_factory.deleteInstance(self.tokenizer);
    self.tokenizer_plugin.destroy(self.tokenizer_factory)
    self.tokenizer, self.tokenizer_factory = None, None
    del self.tokenizer_plugin

  def reset(self):
    self.confidence_factory.deleteInstance(self.confidencer);
    self.confidence_plugin.destroy(self.confidence_factory)

    a = self.confidence_plugin.create()
    self.confidence_factory = a
    if not self.confidence_factory: raise Exception("Confidence plugin failed")
    self.confidence_factory.setLogger(logger)
    self.confidencer = self.confidence_factory.createInstance()
    if not self.confidencer: raise Exception("Confidencer instance failed")


    self.alignment_factory.deleteInstance(self.aligner);
    self.alignment_plugin.destroy(self.alignment_factory)

    self.alignment_factory = self.alignment_plugin.create()
    if not self.alignment_factory: raise Exception("Alignment plugin failed")
    self.alignment_factory.setLogger(logger)
    self.aligner = self.alignment_factory.createInstance()
    if not self.aligner: raise Exception("Aligner instance failed")

    
    self.ol_factory.deleteInstance(self.online_mt);
    self.mt_plugin.destroy(self.ol_factory)

    self.ol_factory = self.mt_plugin.create()
    if not self.ol_factory: raise Exception("Online MT plugin failed")
    self.ol_factory.setLogger(logger)
    self.online_mt = self.ol_factory.createInstance()
    if not self.online_mt: raise Exception("Online MT instance failed")
    
    self.assign_models()
    
    print >> sys.stderr, "Reset finished"    
    

if __name__ == "__main__":
    from sys import argv
    import logging
    import atexit

    logging.getLogger().setLevel(logging.INFO)

    models = Models()
    models.create_plugins()
    atexit.register(models.delete_plugins)
    # Create and start tornadio server
    SocketServer(application)
    
