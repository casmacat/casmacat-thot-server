#! /usr/bin/env python

import sys, os
import datetime, time
import random


from tornado import web
from tornadio2 import SocketConnection, TornadioRouter, SocketServer, event

from casmacat import *

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





ROOT = os.path.normpath(os.path.dirname(__file__))

def filter_utf8(string):
  return string.encode('utf-8')

def to_utf8(obj):
  if isinstance(obj, basestring):
    return filter_utf8(obj)
  elif isinstance(obj, list): 
    return [to_utf8(w) for w in obj]
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
    @event
    def get_alignments(self, source, target):
      source, target = to_utf8(source), to_utf8(target)
      source_tok, source_seg = tokenizer.preprocess(source)
      target_tok, target_seg = tokenizer.preprocess(target)
      matrix = aligner.align(source_tok, target_tok)
      logger.log(DEBUG_LOG, matrix);
      self.emit('alignmentchange', matrix, source, source_seg, target, target_seg)

#class ProcessorConnection(SocketConnection):
    @event
    def get_tokens(self, source, target):
      source, target = to_utf8(source), to_utf8(target)
      source_tok, source_seg = tokenizer.preprocess(source)
      target_tok, target_seg = tokenizer.preprocess(target)
      print >> sys.stderr, "source tok: '%s' -> %s -> %s" % (source, str(source_tok), str(source_seg))
      print >> sys.stderr, "target tok: '%s' -> %s -> %s" % (target, str(target_tok), str(target_seg))
      logger.log(DEBUG_LOG, (source, source_tok))
      logger.log(DEBUG_LOG, (target, target_tok))
      self.emit('translationchange', source, source_seg, target, target_seg)


#class WordConfidenceConnection(SocketConnection):
#    @event
#    def get_translation_confidence(self, source, target, validated_words):
#      source, target = to_utf8(source), to_utf8(target)
#      source_tok, source_seg = tokenizer.preprocess(source)
#      target_tok, target_seg = tokenizer.preprocess(target)
#      conf = confidencer.getSentenceConfidence(source_tok, target_tok, validated_words)
#      self.emit('confidencechange', conf, source, source_seg, target, target_seg)

    @event
    def get_word_confidences(self, source, target, validated_words):
      source, target = to_utf8(source), to_utf8(target)
      source_tok, source_seg = tokenizer.preprocess(source)
      target_tok, target_seg = tokenizer.preprocess(target)
      sent, conf = confidencer.getWordConfidences(source_tok, target_tok, validated_words)
      self.emit('confidencechange', sent, conf, source, source_seg, target, target_seg)

#class MtConnection(SocketConnection):
    @event
    def translate(self, source):
      logger.log(DEBUG_LOG, "Hello Word of Debugging!!!");
      source = to_utf8(source)
      source_tok, source_seg = tokenizer.preprocess(source)
      target_tok = mt.translate(source_tok)
      logger.log(DEBUG_LOG, source_tok);
      logger.log(DEBUG_LOG, target_tok);
      target, target_seg = tokenizer.postprocess(target_tok)
      logger.log(DEBUG_LOG, ("source", source_tok));
      logger.log(DEBUG_LOG, ("target", target_tok));
      self.emit('contributionchange', source, source_seg, target, target_seg)


#class LoggerConnection(SocketConnection, Logger):
    @event
    def on_open(self, info):
      MyLogger.participants.add(self)

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

if __name__ == "__main__":
    from sys import argv
    import logging
    logging.getLogger().setLevel(logging.INFO)


    
    
    tokenizer_plugin = TextProcessorPlugin("plugins/space-tokenizer.so")
    tokenizer_factory = tokenizer_plugin.create()
    tokenizer_factory.setLogger(logger)
    tokenizer = tokenizer_factory.createInstance()
    
#    mt_plugin = MtPlugin("plugins/random-mt-engine.so")
#    mt_plugin = MtPlugin("plugins/moses-mt-engine.so", "-f xerox.models/model/moses.ini")
    mt_plugin = MtPlugin("plugins/libstack_dec.so", "-c /home/valabau/work/software/casmacat-server-library/server/thot/cfg/casmacat_xerox_enes_adapt_wg.cfg", "thot_mt_plugin")
    mt_factory = mt_plugin.create()
    mt_factory.setLogger(logger)
    mt = mt_factory.createInstance()
    
#alignment_plugin = AlignmentPlugin("plugins/random-aligner.so")
    alignment_plugin = AlignmentPlugin("plugins/HMMAligner.so", "thot/models/tm/my_ef_invswm")
    alignment_factory = alignment_plugin.create()
    alignment_factory.setLogger(logger)
    aligner = alignment_factory.createInstance()
    
#    confidence_plugin = ConfidencePlugin("plugins/random-confidence-estimator.so")
    confidence_plugin = ConfidencePlugin("plugins/ibmMax-confidence-estimator.so", "thot/models/tm/my_ef_invswm")
    confidence_factory = confidence_plugin.create()
    confidence_factory.setLogger(logger)
    confidencer = confidence_factory.createInstance()

#imt_plugin = ImtPlugin("plugins/random-imt-engine.so")
#imt_factory = imt_plugin.create()
#imt_factory.setLogger(logger)
#imt = imt_factory.createInstance()



    # Create and start tornadio server
    SocketServer(application)

    del tokenizer, tokenizer_factory, tokenizer_plugin 
    del mt, mt_factory, mt_plugin
    del aligner, alignment_factory, alignment_plugin
    del confidencer, confidence_factory, confidence_plugin
    del imt, imt_factory, imt_plugin
