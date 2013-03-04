#! /usr/bin/env python
# -*- coding: utf-8 -*-

import sys, traceback, os, re
import datetime, time
import random, math, codecs, copy
import collections
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
      print >> sys.stderr, "TIME:%s:started" % (self.name)
      start_time = datetime.datetime.now()

      print >> logfd, """/*\n  Server method "%s" invoked\n  %s\n*/\n\n"%s": %s\n""" % (self.name, str(datetime.datetime.now()), self.name, json.dumps(kwargs, indent=2, separators=(',', ': '), encoding="utf-8"))

      ret = function(*args, **kwargs)
      elapsed_time = datetime.datetime.now() - start_time
      print >> sys.stderr, "TIME:%s:%s" % (self.name, fmt_delta(elapsed_time))
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
          args[0].respond(self.emission, { 'errors': [traceback.format_exc()], 'data': None })
        print >> sys.stderr, traceback.format_exc()
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

def new_match(created_by, target, target_seg, elapsed_time):
  match = {}
  match['target'] = target
  match['targetSegmentation'] = target_seg
  match['quality'] = 75
  if created_by == 'OL':
    match['quality'] = 70
  match['author'] = created_by
  match['elapsedTime'] = elapsed_time.total_seconds()*1000.0
  return match

def new_prediction(created_by, prediction, prediction_seg, elapsed_time):
  match = {}
  match['target'] = prediction
  match['targetSegmentation'] = prediction_seg
  match['quality'] = 75
  if created_by == 'OL':
    match['quality'] = 70
  match['author'] = created_by
  match['elapsedTime'] = elapsed_time.total_seconds()*1000.0
  return match

def new_contributions(source, source_seg):
  data = {}
  data['source'] = source
  data['sourceSegmentation'] = source_seg
  data['nbest'] = []
  return { 'errors': [], 'data': data }

def new_predictions(source, source_seg, caret_pos):
  data = {}
  data['source'] = source
  data['sourceSegmentation'] = source_seg
  data['caretPos'] = caret_pos
  data['nbest'] = []
  return { 'errors': [], 'data': data }

def add_match(obj, match):
  obj['data']['nbest'].append(match)

def prepare(obj):
  obj['data']['elapsedTime'] = sum([m['elapsedTime'] for m in obj['data']['nbest']])
  if len(obj['data']['nbest']) > 0:
    obj['data']['nbest'].sort(key=lambda match: match['quality'], reverse=True)
    #print obj['data']['nbest']
    #obj['data']['translatedText'] = obj['data']['nbest'][0]['translation']
    #obj['data']['translatedTextTokens'] = obj['data']['nbest'][0]['translationTokens']


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

def split_utf8(string, pos):
  string = string.decode('utf-8')
  return string[:pos].encode('utf-8'), string[pos:].encode('utf-8')

def len_utf8(string):
  return len(string.decode('utf-8'))

#def to_utf8(obj):
#  if obj == None:
#    return obj
#  elif isinstance(obj, basestring):
#    return filter_utf8(obj)
#  elif isinstance(obj, list):
#    return [to_utf8(w) for w in obj]
#  print "Unknown type", type(obj), "for object", obj
#  raise "Unknown type"


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

class ReplacementRule:
  def __init__(self, data):
    self.target_rule = data['targetRule']
    self.replacement = data['targetReplacement']
    self.fails = 0
    if 'ruleId' in data:
      self.rule_id   = data['ruleId']
    else:
      self.rule_id   = None
    if 'sourceRule' in data and data['sourceRule'] != "":
      self.source_rule = data['sourceRule']
    else:
      self.source_rule = None
    if 'matchCase' in data:
      self.match_case  = data['matchCase']
    else:
      self.match_case = False
    if 'isRegExp' in data:
      self.is_regexp   = data['isRegExp']
    else:
      self.is_regexp   = False
    if 'persistent' in data:
      self.persistent  = data['persistent']
    else:
      self.persistent  = False 

    flags = 0
    if not self.match_case:
      flags = re.IGNORECASE

    sr = self.source_rule
    tr = self.target_rule
    if not self.is_regexp:
      if sr: sr = re.escape(sr)
      tr = re.escape(tr)

    if sr:
      self.re_source = re.compile(sr, flags)
    else:
      self.re_source = None 
    self.re_target = re.compile(tr, flags)

  def apply(self, source, target):
    try:
      if self.re_source:
        source_match = self.re_source.search(source)
      else:
        source_match = True
      if source_match:
        target = self.re_target.sub(self.replacement, target)
    except:
      self.fails += 1
    return target

  def toJSON(self):
    data = {
      'ruleId': self.rule_id, 
      'nFails': self.fails, 
      'sourceRule': self.source_rule, 
      'targetRule': self.target_rule, 
      'targetReplacement': self.replacement, 
      'matchCase': self.match_case, 
      'isRegExp': self.is_regexp, 
      'persistent': self.persistent 
    }
    return data    

class Rules:
  def __init__(self):
    self.rules = []
    self.idx = {}
    self.last_id = 0

  def add(self, rule):
    rule_id = rule.rule_id
    if rule_id: 
      old = self.idx[rule_id]
      pos = self.rules.index(old)
      self.idx[rule_id] = rule
      self.rules[pos]   = rule

    else:
      rule_id = self.last_id
      self.last_id += 1
      rule.rule_id = rule_id
      self.rules.append(rule)
      self.idx[rule_id] = rule

    return rule_id

  def remove(self, rule_id):
    if rule_id in self.idx:
      old = self.idx[rule_id]
      del self.idx[rule_id]
      self.rules.remove(old)

  def apply(self, source, _target):
    target = _target
    for rule in self.rules:
      target = rule.apply(source, target)
    return target

  def __len__(self):
    return len(self.rules)

  def toJSON(self):
    data = []
    for rule in self.rules:
      data.append(rule.toJSON())
    return data



class CasmacatConnection(SocketConnection):
    def respond(self, *args, **kwargs):
      print >> sys.stderr, "emit", args, kwargs
      print >> logfd, """/*\n  Server response "%s"\n  %s\n*/\n\n"%s": %s\n""" % (args[0], str(datetime.datetime.now()), args[0], json.dumps(args[1:], indent=2, separators=(',', ': '), encoding="utf-8"))
      self.emit(*args, **kwargs)

    @event('getAlignments')
    @timer('getAlignments')
    @thrower('getAlignmentsResult')
    def getAlignments(self, data):
      print >> sys.stderr, 'data:', data
      source, target = to_utf8(data['source']), to_utf8(data['target'])
      source_tok, source_seg = models.source_tokenizer.preprocess(source)
      target_tok, target_seg = models.target_tokenizer.preprocess(target)

      start_time = datetime.datetime.now()
      matrix = models.aligner.align(source_tok, target_tok)
      elapsed_time = datetime.datetime.now() - start_time

      logger.log(DEBUG_LOG, matrix);
      obj = { 'alignments': matrix,
              'source': source,
              'sourceSegmentation': source_seg,
              'target': target,
              'targetSegmentation': target_seg,
              'elapsedTime': elapsed_time.total_seconds()*1000.0
            }
      self.respond('getAlignmentsResult', { 'errors': [], 'data': obj })

    @event('setReplacementRule')
    @timer('setReplacementRule')
    @thrower('setReplacementRuleResult')
    def setReplacementRule(self, data):
      print >> sys.stderr, 'data:', data
      source_rule, target_rule = to_utf8(data['sourceRule']), to_utf8(data['targetRule'])

      start_time = datetime.datetime.now()
      rule_id  = self.rules.add(ReplacementRule(to_utf8(data)))

      elapsed_time = datetime.datetime.now() - start_time

      obj = { 'elapsedTime': elapsed_time.total_seconds()*1000.0, 'ruleId': rule_id }
      self.respond('setReplacementRuleResult', { 'errors': [], 'data': obj })


    @event('getReplacementRules')
    @timer('getReplacementRules')
    @thrower('getReplacementRulesResult')
    def getReplacementRules(self):
      start_time = datetime.datetime.now()
      rules = self.rules.toJSON()
      elapsed_time = datetime.datetime.now() - start_time
      obj = { 'elapsedTime': elapsed_time.total_seconds()*1000.0, 'rules': rules }
      self.respond('getReplacementRulesResult', { 'errors': [], 'data': obj })


    @event('delReplacementRule')
    @timer('delReplacementRule')
    @thrower('delReplacementRuleResult')
    def delReplacementRule(self, data):
      start_time = datetime.datetime.now()
      self.rules.remove(data['ruleId'])
      elapsed_time = datetime.datetime.now() - start_time
      obj = { 'elapsedTime': elapsed_time.total_seconds()*1000.0 }
      self.respond('delReplacementRuleResult', { 'errors': [], 'data': obj })


    @event('applyReplacementRules')
    @timer('applyReplacementRules')
    @thrower('applyReplacementRulesResult')
    def applyReplacementRulesResult(self, data):
      print >> sys.stderr, 'data:', data
      source, target = to_utf8(data['source']), to_utf8(data['target'])

      start_time = datetime.datetime.now()
      source_tok, source_seg = models.source_tokenizer.preprocess(source)
      if len(self.rules):
        target = self.rules.apply(self.source, target)
        target_tok, target_seg = models.target_tokenizer.preprocess(target)

      elapsed_time = datetime.datetime.now() - start_time

      obj = {
              'source': source,
              'sourceSegmentation': source_seg,
              'target': target,
              'targetSegmentation': target_seg,
              'elapsedTime': elapsed_time.total_seconds()*1000.0
            }
      self.respond('applyReplacementRulesResult', { 'errors': [], 'data': obj })


    @event('getTokens')
    @timer('getTokens')
    @thrower('getTokensResult')
    def getTokens(self, data):
      print >> sys.stderr, 'data:', data
      source, target = to_utf8(data['source']), to_utf8(data['target'])

      start_time = datetime.datetime.now()
      source_tok, source_seg = models.source_tokenizer.preprocess(source)
      target_tok, target_seg = models.target_tokenizer.preprocess(target)
      elapsed_time = datetime.datetime.now() - start_time

      obj = {
              'source': source,
              'sourceSegmentation': source_seg,
              'target': target,
              'targetSegmentation': target_seg,
              'elapsedTime': elapsed_time.total_seconds()*1000.0
            }
      self.respond('getTokensResult', { 'errors': [], 'data': obj })


    @event('getConfidences')
    @timer('getConfidences')
    @thrower('getConfidencesResult')
    def getConfidencesResult(self, data):
      print >> sys.stderr, 'data:', data
      source, target = to_utf8(data['source']), to_utf8(data['target'])
      source_tok, source_seg = models.source_tokenizer.preprocess(source)
      target_tok, target_seg = models.target_tokenizer.preprocess(target)
      if 'validatedTokens' not in data: data['validatedTokens'] = []

      start_time = datetime.datetime.now()
      validated_words = []
      diff = len(target_tok) - len(data['validatedTokens'])
      if diff >= 0: validated_words = data['validatedTokens']
      validated_words.extend([False]*diff)
      sent, conf = models.confidencer.getWordConfidences(source_tok, target_tok, validated_words)
      elapsed_time = datetime.datetime.now() - start_time

      obj = {
        'quality': sent,
        'confidences': conf,
        'source': source,
        'sourceSegmentation': source_seg,
        'target': target,
        'targetSegmentation': target_seg,
        'elapsedTime': elapsed_time.total_seconds()*1000.0
      }
      print >> sys.stderr, 'confidences:', obj
      self.respond('getConfidencesResult', { 'errors': [], 'data': obj })

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
#    "nbest": [{
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
    @event('decode')
    @timer('decode')
    @thrower('decodeResult')
    def decode(self, data):
      print >> sys.stderr, 'data:', data
      source = to_utf8(data['source'])
      source_tok, source_seg = models.source_tokenizer.preprocess(source)
      print >> sys.stderr, "WGSENT", source, "->", "'" + " ".join(source_tok) + "'"
      contributions = new_contributions(source, source_seg)

      mode = self.config['mode']
      if mode == "PE": mode = "ITP"
      for name, mt in models.mt_systems.iteritems():
        if name == mode or self.config['useSuggestions']:
          start_time = datetime.datetime.now()
          target_tok = mt.translate(source_tok)
          elapsed_time = datetime.datetime.now() - start_time

          target, target_seg = models.target_tokenizer.postprocess(target_tok)
          if len(self.rules):
            target = self.rules.apply(source, target)
            target_tok, target_seg = models.target_tokenizer.preprocess(target)
          match = new_match(name, target, target_seg, elapsed_time)
          add_match(contributions, match)


      prepare(contributions)
      self.respond('decodeResult', contributions)

    @event('validate')
    @timer('validate')
    @thrower('validateResults')
    def validate(self, data):
      source = to_utf8(data['source'])
      source_tok, source_seg = models.source_tokenizer.preprocess(source)
      target = to_utf8(data['target'])
      target_tok, target_seg = models.target_tokenizer.preprocess(target)
      start_time = datetime.datetime.now()
      for name, ol in models.ol_systems.iteritems():
        ol.update(source_tok, target_tok)
      elapsed_time = datetime.datetime.now() - start_time
      models.updates.append({'source': source, 'target': target})
      obj = { 'elapsedTime': elapsed_time }
      self.respond('validateResults', { 'errors': [], 'data': obj })

    @event('getValidatedContributions')
    @timer('getValidatedContributions')
    @thrower('getValidatedContributionsResult')
    def getValidatedContributions(self):
      obj = { 'contributions': models.updates, 'elapsedTime': 0 }
      self.respond('getValidatedContributionsResult', { 'errors': [], 'data': obj })


#class ImtConnection(SocketConnection):
    @event('startSession')
    @timer('startSession')
    @thrower('startSessionResult')
    def startSession(self, data):
      print >> sys.stderr, 'data:', data
      self.source = to_utf8(data['source'])
      for name, session in self.imt_session.iteritems():
          models.imt_systems[name].deleteSession(session)
      self.imt_session = {}

      source_tok, source_seg = models.source_tokenizer.preprocess(self.source)
      self.source_tok, self.source_seg = source_tok, source_seg
      logger.log(DEBUG_LOG, "starting imt session with " + str(source_tok));

      start_time = datetime.datetime.now()
      for name, imt in models.imt_systems.iteritems():
        if name == self.config['mode'] or self.config['useSuggestions']:
          self.imt_session[name] = imt.newSession(source_tok)
      elapsed_time = datetime.datetime.now() - start_time

      obj = { 'elapsedTime': elapsed_time.total_seconds()*1000.0 }
      self.respond('startSessionResult', { 'errors': [], 'data': obj })






    def splitPoint(self, prediction_seg, prefix_last_tok, last_token_partial_len): 
      if prefix_last_tok >= 0:
        if not last_token_partial_len: # if complete word return start of next token
          if len(prediction_seg) > prefix_last_tok + 1: 
            return prediction_seg[prefix_last_tok + 1][0]
          else:
            return prediction_seg[prefix_last_tok][1]
        else: # if partial word return the position of the cursor. 
          # XXX: This assumes that the prefix of the last word does not change in length
          return prediction_seg[prefix_last_tok][0] + last_token_partial_len
      return 0
    
    
    # after preprocessing, prediction might not be compatible with the real prefix
    # in case of last token NOT partial, the tokenization SHOULD NOT affect the prefix
    # in case of last token being partial, we must ensure that the prefix is compatible
    def postprocessPrediction(self, prefix, prefix_seg, prediction_tok, last_token_partial_len, prefix_last_tok):
    
      # compute the segmentation for the whole new prediction. Note that le segmentation for
      # the prefix might have changed
      prediction, prediction_seg = models.target_tokenizer.postprocess(prediction_tok)
    
      # so we split the new prediction at the point where the original cursor should be
      s = self.splitPoint(prediction_seg, prefix_last_tok, last_token_partial_len)
      r_pref, r_suf = split_utf8(prediction, s)
    
      # if the new prefix is not the one given by the user then make it so
      if r_pref != prefix:
        print >> sys.stderr, 'XXXXX: tokenizer changed the prefix from "%s" o "%s"' % (prefix, r_pref)
        prediction = prefix + r_suf
    
      # apply the replacement rules to the suffix
      if len(self.rules):
        print >> sys.stderr, 'XXXXX', prefix, '###', r_suf
        prediction = prefix + self.rules.apply(self.source, r_suf)
        prediction_tok, prediction_seg = models.target_tokenizer.preprocess(prediction)
    
        # as the prefix might have changed, we need to restore if 
        s = self.splitPoint(prediction_seg, prefix_last_tok, last_token_partial_len)
        r_pref, r_suf = split_utf8(prediction, s)
    
        # if the new prefix is not the one given by the user then make it so
        if r_pref != prefix:
          print >> sys.stderr, 'XXXXX: tokenizer changed the prefix from "%s" o "%s"' % (prefix, r_pref)
          prediction = prefix + r_suf
    
    
      # now, we have a prediction with the user prefix. XXX: we assume the tokens are also correct
      # but we neeed to adjust the segmentation
    
      # compute the non-token chars the user has introduced at the end of the prefix
      if prefix_last_tok >= 0:
        print >> sys.stderr, "############## PREFIX '%s'" % prefix, prefix_last_tok, prefix_seg
        print >> sys.stderr, "############## PREFIX LEN", len_utf8(prefix), prefix_seg[prefix_last_tok][1], len_utf8(prefix) - prefix_seg[prefix_last_tok][1]
        diff = len_utf8(prefix) - prefix_seg[prefix_last_tok][1]

        # we compute the prefix segmentation for the original prefix (the one given by the user)
        # the suffix of the last token might have changed
        orig_last_token_end = prefix_seg[prefix_last_tok][0] + len_utf8(prediction_tok[prefix_last_tok])
        prefix_seg = [s for s in prefix_seg[:prefix_last_tok]] + [(prefix_seg[prefix_last_tok][0], orig_last_token_end)]
    
        # where the last token ends in the postprocessed prediction
        new_last_token_end = prediction_seg[prefix_last_tok][0] + len_utf8(prediction_tok[prefix_last_tok])
    
        # thus, we need to move the suffix by
        diff += orig_last_token_end - new_last_token_end
        #diff = len_utf8(prefix) - prefix_seg[prefix_last_tok][1] + orig_last_token_end - new_last_token_end
        #       original prefix seg.,    we need to adjust the suffix with the new prefix length
        prediction_seg = prefix_seg +  [(s[0]+diff, s[1]+diff) for s in prediction_seg[prefix_last_tok + 1:]]
    
      return prediction, prediction_seg, prediction_tok



    @event('setPrefix')
    @timer('setPrefix')
    @thrower('setPrefixResult')
    def setPrefix(self, data):
      print >> sys.stderr, 'data:', data
      target = data['target']
      caret_pos = data['caretPos']
      num_results = data['numResults'] if 'numResults' in data else 0

      logger.log(DEBUG_LOG, str(caret_pos) + " @ " + to_utf8(target))

      prefix = to_utf8(target[:caret_pos])
      suffix = to_utf8(target[caret_pos:])

      prefix_tok, prefix_seg = models.target_tokenizer.preprocess(prefix)
      suffix_tok, suffix_seg = models.target_tokenizer.preprocess(suffix)

      print >> sys.stderr, "prefix '%s'" % prefix, prefix_tok, prefix_seg 
      print >> sys.stderr, "suffix '%s'" % suffix, suffix_tok, suffix_seg

      last_token_is_partial = True
      prefix_last_tok = len(prefix_tok) - 1 
      if len(prefix) == 0 or prefix[-1].isspace():
        last_token_is_partial = False
        last_token_partial_len = 0
      else:
        last_token_partial_len = len_utf8(prefix_tok[-1])
      print >> sys.stderr, "last_token_is_partial", last_token_is_partial

      predictions = new_predictions(self.source, self.source_seg, caret_pos)

      for name, session in self.imt_session.iteritems():
        if name == self.config['mode'] or self.config['useSuggestions']:
          start_time = datetime.datetime.now()
          prediction_tok = session.setPrefix(prefix_tok, suffix_tok, last_token_is_partial)
          elapsed_time = datetime.datetime.now() - start_time
          print >> sys.stderr, name, "prediction_tok", prediction_tok

          # make sure that the new prediction is at least as long as the prefix
          # which is the result of a system that doesn't have paths to continue
          # the prefix
          if len(prediction_tok) >= len(prefix_tok):
            prediction, prediction_seg, prediction_tok = self.postprocessPrediction(prefix, prefix_seg, prediction_tok, last_token_partial_len, prefix_last_tok)

            match = new_prediction(name, prediction, prediction_seg, elapsed_time)

            if "prioritizer" in self.config and self.config["prioritizer"] in models.word_prioritizers and self.source_tok:
              wp = models.word_prioritizers[self.config["prioritizer"]]
              n_ok = len(prefix_tok)
              if last_token_is_partial:
                n_ok -= 1
              validated = [True]*n_ok + [False]*(len(prediction_tok) - n_ok)
              priority = wp.word_prioritizer.getWordPriorities(self.source_tok, prediction_tok, validated)
              match["priorities"] = priority

            add_match(predictions, match)
          else:
            predictions["errors"].append("The server cannot provide a completion to the prefix")
      prepare(predictions)
      print >> sys.stderr, "SUGGESTIONS:", predictions
      self.respond('setPrefixResult', predictions)

    @event('rejectSuffix')
    @timer('rejectSuffix')
    @thrower('rejectSuffixResult')
    def rejectSuffix(self, data):
      print >> sys.stderr, 'data:', data
      target = data['target']
      caret_pos = data['caretPos']
      num_results = data['numResults'] if 'numResults' in data else 0

      logger.log(DEBUG_LOG, str(caret_pos) + " @ " + to_utf8(target))

      prefix = to_utf8(target[:caret_pos])
      suffix = to_utf8(target[caret_pos:])

      print >> sys.stderr, "prefix '%s'" % prefix, type(prefix)
      print >> sys.stderr, "suffix '%s'" % suffix, type(suffix)

      prefix_tok, prefix_seg = models.target_tokenizer.preprocess(prefix)
      suffix_tok, suffix_seg = models.target_tokenizer.preprocess(suffix)

      last_token_is_partial = True
      prefix_last_tok = len(prefix_tok) - 1 
      if len(prefix) == 0 or prefix[-1].isspace():
        last_token_is_partial = False
        last_token_partial_len = 0
      else:
        last_token_partial_len = len_utf8(prefix_tok[-1])
      print >> sys.stderr, "last_token_is_partial", last_token_is_partial

      predictions = new_predictions(self.source, self.source_seg, caret_pos)

      for name, session in self.imt_session.iteritems():
        if name == self.config['mode'] or self.config['useSuggestions']:
          start_time = datetime.datetime.now()
          prediction_tok = session.rejectSuffix(prefix_tok, suffix_tok, last_token_is_partial)
          elapsed_time = datetime.datetime.now() - start_time
          print >> sys.stderr, name, "prediction_tok", prediction_tok

          # make sure that the new prediction is at least as long as the prefix
          # which is the result of a system that doesn't have paths to continue
          # the prefix
          if len(prediction_tok) >= len(prefix_tok):
            prediction, prediction_seg, prediction_tok = self.postprocessPrediction(prefix, prefix_seg, prediction_tok, last_token_partial_len, prefix_last_tok)

            match = new_prediction(name, prediction, prediction_seg, elapsed_time)

            if "prioritizer" in self.config and self.config["prioritizer"] in models.word_prioritizers and self.source_tok:
              wp = models.word_prioritizers[self.config["prioritizer"]]
              n_ok = len(prefix_tok)
              if last_token_is_partial:
                n_ok -= 1
              validated = [True]*n_ok + [False]*(len(prediction_tok) - n_ok)
              priority = wp.word_prioritizer.getWordPriorities(self.source_tok, prediction_tok, validated)
              match["priorities"] = priority

            add_match(predictions, match)
          else:
            predictions["errors"].append("The server cannot provide a completion to the prefix since the user has rejected all the options")
      prepare(predictions)
      print >> sys.stderr, "SUGGESTIONS:", predictions
      self.respond('rejectSuffixResult', predictions)

    @event('endSession')
    @timer('endSession')
    @thrower('endSessionResult')
    def endSessionResult(self):
      for name, session in self.imt_session.iteritems():
          models.imt_systems[name].deleteSession(session)
      self.imt_session = {}
      logger.log(DEBUG_LOG, "ending imt session");

      elapsed_time = datetime.datetime.now() - start_time
      obj = { 'elapsedTime': elapsed_time.total_seconds()*1000.0 }
      self.respond('endSessionResult', { 'errors': [], 'data': obj })

    @event('reset')
    @timer('reset')
    @thrower('resetResult')
    def reset(self):
      start_time = datetime.datetime.now()
      models.reset()
      elapsed_time = datetime.datetime.now() - start_time
      obj = { 'elapsedTime': elapsed_time.total_seconds()*1000.0 }
      self.respond('resetResult', { 'errors': [], 'data': obj })

    @event('configure')
    @timer('configure')
    @thrower('configureResult')
    def configure(self, data):
      self.config = data
      print >> sys.stderr, self.config
      self.respond('configureResult', { 'errors': [], 'data': data })

    @event('getServerConfig')
    @timer('getServerConfig')
    @thrower('getServerConfigResult')
    def getServerConfig(self):
      obj = {'config': models.config, 'elapsedTime': 0 }
      self.respond('getServerConfigResult', { 'errors': [], 'data': obj })

    @event('ping')
    @timer('ping')
    @thrower('pingResult')
    def ping(self, data):
      data['elapsedTime'] = 0
      self.respond('pingResult', { 'errors': [], 'data': data })

#class LoggerConnection(SocketConnection, Logger):
    @event
    def on_open(self, info):
      print >> sys.stderr, "Connection Info", repr(info.__dict__)
      MyLogger.participants.add(self)
      self.imt_session = {}
      self.config = { 'useSuggestions': False, 'mode': u'PE' }
      self.rules = Rules()

    @event
    def on_close(self):
      MyLogger.participants.remove(self)
      self.rules = None


class RouterConnection(SocketConnection):
    __endpoints__ = {#'/mt': MtConnection,
                     #'/aligner': AlignerConnection,
                     #'/word_confidence': WordConfidenceConnection,
                     #'/logger': LoggerConnection
                     '/casmacat': CasmacatConnection
                     }

    def on_open(self, info):
        print >> sys.stderr, 'Router', repr(info)


# Create tornadio router
CasmacatRouter = TornadioRouter(RouterConnection)


class WordPriorityContainer:
  last_id = 0
  def __init__(self, config):
    self.config = copy.deepcopy(config)
    if "id" not in self.config:
      self.config["id"] = "word_priority_plugin_%d" % last_id
      last_id += 1
    start_time = datetime.datetime.now()
    self.word_priority_plugin = WordPriorityPlugin(config["module"], config["parameters"])
    self.word_priority_factory = self.word_priority_plugin.create()
    if not self.word_priority_factory: raise Exception("Word prioritizer plugin failed")
    self.word_priority_factory.setLogger(logger)
    self.word_prioritizer = self.word_priority_factory.createInstance()
    if not self.word_prioritizer: raise Exception("Word prioritizer instance failed")
    elapsed_time = datetime.datetime.now() - start_time
    print >> sys.stderr, "TIME:%s loaded:%s" % ("word-prioritizer", fmt_delta(elapsed_time))

  def __del__(self):
    self.word_priority_factory.deleteInstance(self.word_prioritizer);
    self.word_priority_plugin.destroy(self.word_priority_factory)
    self.word_prioritizer, self.word_priority_factory = None, None
    del self.word_priority_plugin

  def reset(self):
    pass



class Models:
  def __init__(self, config_fn):
    self.config = json.load(open(config_fn))
    print >> sys.stderr, "config", json.dumps(self.config)
    print >> logfd, "config", json.dumps(self.config)
    self.mt_systems = {}
    self.imt_systems = {}
    self.ol_systems = {}
    self.updates = []

  def assign_models(self):
    self.mt_systems["ITP"] = self.static_mt
    self.imt_systems["ITP"] = self.static_mt

    if self.online_mt:
      self.mt_systems["ITP-OL"] = self.online_mt
      self.imt_systems["ITP-OL"] = self.online_mt
      self.ol_systems["ITP-OL"] = self.online_mt

    self.ol_systems["ALIGNER"] = self.aligner
    self.ol_systems["CONFIDENCER"] = self.confidencer


  @timer('create_plugins')
  def create_plugins(self):
    start_time = datetime.datetime.now()
    self.source_tokenizer_plugin = TextProcessorPlugin(self.config["source-processor"]["module"], self.config["source-processor"]["parameters"])
    self.source_tokenizer_factory = self.source_tokenizer_plugin.create()
    if not self.source_tokenizer_factory: raise Exception("Tokenizer plugin failed")
    self.source_tokenizer_factory.setLogger(logger)
    self.source_tokenizer = self.source_tokenizer_factory.createInstance()
    if not self.source_tokenizer: raise Exception("Tokenizer instance failed")
    elapsed_time = datetime.datetime.now() - start_time
    print >> sys.stderr, "TIME:%s loaded:%s" % ("source-tokenizer", fmt_delta(elapsed_time))

    start_time = datetime.datetime.now()
    self.target_tokenizer_plugin = TextProcessorPlugin(self.config["target-processor"]["module"], self.config["target-processor"]["parameters"])
    self.target_tokenizer_factory = self.target_tokenizer_plugin.create()
    if not self.target_tokenizer_factory: raise Exception("Tokenizer plugin failed")
    self.target_tokenizer_factory.setLogger(logger)
    self.target_tokenizer = self.target_tokenizer_factory.createInstance()
    if not self.target_tokenizer: raise Exception("Tokenizer instance failed")
    elapsed_time = datetime.datetime.now() - start_time
    print >> sys.stderr, "TIME:%s loaded:%s" % ("target-tokenizer", fmt_delta(elapsed_time))


    if "name" in self.config["mt"]:
      self.mt_plugin = ImtPlugin(self.config["mt"]["module"], self.config["mt"]["parameters"], self.config["mt"]["name"])
    else:
      self.mt_plugin = ImtPlugin(self.config["mt"]["module"], self.config["mt"]["parameters"])

    start_time = datetime.datetime.now()
    self.mt_factory = self.mt_plugin.create()
    if not self.mt_factory: raise Exception("MT plugin failed")
    self.mt_factory.setLogger(logger)
    self.static_mt = self.mt_factory.createInstance()
    if not self.static_mt: raise Exception("Static MT instance failed")
    elapsed_time = datetime.datetime.now() - start_time
    print >> sys.stderr, "TIME:%s loaded:%s" % ("static mt", fmt_delta(elapsed_time))

    if "online" in self.config["mt"] and self.config["mt"]["online"]:
      start_time = datetime.datetime.now()
      self.ol_factory = self.mt_plugin.create()
      if not self.ol_factory: raise Exception("Online MT plugin failed")
      self.ol_factory.setLogger(logger)
      self.online_mt = self.ol_factory.createInstance()
      if not self.online_mt: raise Exception("Online MT instance failed")
      elapsed_time = datetime.datetime.now() - start_time
      print >> sys.stderr, "TIME:%s loaded:%s" % ("online mt", fmt_delta(elapsed_time))
    else:
      self.ol_factory = None
      self.online_mt = None

    start_time = datetime.datetime.now()
    self.alignment_plugin = AlignmentPlugin(self.config["aligner"]["module"], self.config["aligner"]["parameters"])
    self.alignment_factory = self.alignment_plugin.create()
    if not self.alignment_factory: raise Exception("Alignment plugin failed")
    self.alignment_factory.setLogger(logger)
    self.aligner = self.alignment_factory.createInstance()
    if not self.aligner: raise Exception("Aligner instance failed")
    elapsed_time = datetime.datetime.now() - start_time
    print >> sys.stderr, "TIME:%s loaded:%s" % ("aligner", fmt_delta(elapsed_time))


    start_time = datetime.datetime.now()
    self.confidence_plugin = ConfidencePlugin(self.config["confidencer"]["module"], self.config["confidencer"]["parameters"])
    self.confidence_factory = self.confidence_plugin.create()
    if not self.confidence_factory: raise Exception("Confidence plugin failed")
    self.confidence_factory.setLogger(logger)
    self.confidencer = self.confidence_factory.createInstance()
    if not self.confidencer: raise Exception("Confidencer instance failed")
    elapsed_time = datetime.datetime.now() - start_time
    print >> sys.stderr, "TIME:%s loaded:%s" % ("confidencer", fmt_delta(elapsed_time))

    self.word_prioritizers = {}
    if "word-prioritizer" in self.config:
      if type(self.config["word-prioritizer"]) is list:
        for wp in self.config["word-prioritizer"]:
          plugin = WordPriorityContainer(wp)
          self.word_prioritizers[plugin.config['id']] = plugin
      else:
        plugin = WordPriorityContainer(self.config["word-prioritizer"])
        self.word_prioritizers[plugin.config['id']] = plugin

    self.assign_models()
    print >> sys.stderr, "Plugins loaded"


  @timer('delete_plugins')
  def delete_plugins(self):
    for k, v in self.word_prioritizers.iteritems():
      del v
    self.word_prioritizers = None

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

    if self.online_mt:
      self.ol_factory.deleteInstance(self.online_mt);
      self.mt_plugin.destroy(self.ol_factory)
      self.online_mt, self.ol_factory = None, None

    del self.mt_plugin

    self.source_tokenizer_factory.deleteInstance(self.source_tokenizer);
    self.source_tokenizer_plugin.destroy(self.source_tokenizer_factory)
    self.source_tokenizer, self.source_tokenizer_factory = None, None
    del self.source_tokenizer_plugin

    self.target_tokenizer_factory.deleteInstance(self.target_tokenizer);
    self.target_tokenizer_plugin.destroy(self.target_tokenizer_factory)
    self.target_tokenizer, self.target_tokenizer_factory = None, None
    del self.target_tokenizer_plugin

  @timer('reset')
  def reset(self):
    if len(self.updates) > 0:

      self.updates = []
      print >> sys.stderr, "deleteInstance confidencer"
      self.confidence_factory.deleteInstance(self.confidencer);
      print >> sys.stderr, "destroy confidence factory"
      self.confidence_plugin.destroy(self.confidence_factory)

      print >> sys.stderr, "create confidence factory"
      self.confidence_factory = self.confidence_plugin.create()
      if not self.confidence_factory: raise Exception("Confidence plugin failed")
      self.confidence_factory.setLogger(logger)
      print >> sys.stderr, "create confidencer instance"
      self.confidencer = self.confidence_factory.createInstance()
      if not self.confidencer: raise Exception("Confidencer instance failed")


      print >> sys.stderr, "deleteInstance aligner"
      self.alignment_factory.deleteInstance(self.aligner);
      print >> sys.stderr, "destroy alignment factory"
      self.alignment_plugin.destroy(self.alignment_factory)

      print >> sys.stderr, "create alignment factory"
      self.alignment_factory = self.alignment_plugin.create()
      if not self.alignment_factory: raise Exception("Alignment plugin failed")
      self.alignment_factory.setLogger(logger)
      print >> sys.stderr, "create aligner instance"
      self.aligner = self.alignment_factory.createInstance()
      if not self.aligner: raise Exception("Aligner instance failed")


      if self.online_mt:
        print >> sys.stderr, "deleteInstance online mt"
        self.ol_factory.deleteInstance(self.online_mt);
        print >> sys.stderr, "destroy online mt factory"
        self.mt_plugin.destroy(self.ol_factory)

        print >> sys.stderr, "create online mt factory"
        self.ol_factory = self.mt_plugin.create()
        if not self.ol_factory: raise Exception("Online MT plugin failed")
        self.ol_factory.setLogger(logger)
        print >> sys.stderr, "create online mt instance"
        self.online_mt = self.ol_factory.createInstance()
        if not self.online_mt: raise Exception("Online MT instance failed")

      self.assign_models()

    print >> sys.stderr, "Reset finished"


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

    port = 3019
    try:
      port = int(args[0])
    except:
      try:
        port = models.config["server"]["port"]
      except:
        pass

    models = Models(config_fn)
    models.create_plugins()
    atexit.register(models.delete_plugins)




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
        socket_io_port = port
    )


    print >> logfd, """/*\n  Casmacat server started on port %d\n  %s\n*/\n\n"config": %s\n\n\n""" % (port, str(datetime.datetime.now()), json.dumps(models.config, indent=2, separators=(',', ': '), encoding="utf-8"))

    # Create and start tornadio server
    SocketServer(application)


