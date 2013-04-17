#! /usr/bin/env python
# -*- coding: utf-8 -*-

import sys, traceback, os, re
import random, math, copy
import collections
try: import simplejson as json
except ImportError: import json
import casmacat_models

from tornado import web
from tornadio2 import SocketConnection, TornadioRouter, SocketServer, event

from server_utils import *
from casmacat import *

def timediff(elapsed_time):
  return elapsed_time.total_seconds()*1000.0

def new_match(created_by, target, target_seg, elapsed_time):
  match = {}
  match['target'] = target
  match['targetSegmentation'] = target_seg
  match['quality'] = 0.75
  if created_by == 'OL':
    match['quality'] = 0.70
  match['author'] = created_by
  match['elapsedTime'] = timediff(elapsed_time)
  return match
 
def new_prediction(created_by, prediction, prediction_seg, elapsed_time):
  match = {}
  match['target'] = prediction
  match['targetSegmentation'] = prediction_seg
  match['quality'] = 0.75
  if created_by == 'OL':
    match['quality'] = 0.70
  match['author'] = created_by
  match['elapsedTime'] = timediff(elapsed_time)
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
      print >> get_logfd(), """/*\n  Server response "%s"\n  %s\n*/\n\n"%s": %s\n""" % (args[0], str(datetime.datetime.now()), args[0], json.dumps(args[1:], indent=2, separators=(',', ': '), encoding="utf-8"))
      self.emit(*args, **kwargs)

    @event('setReplacementRule')
    @timer('setReplacementRule')
    @thrower('setReplacementRuleResult')
    def setReplacementRule(self, data):
      print >> sys.stderr, 'data:', data
      source_rule, target_rule = to_utf8(data['sourceRule']), to_utf8(data['targetRule'])

      start_time = datetime.datetime.now()
      rule_id  = self.rules.add(ReplacementRule(to_utf8(data)))

      elapsed_time = datetime.datetime.now() - start_time

      obj = { 'elapsedTime': timediff(elapsed_time), 'ruleId': rule_id }
      self.respond('setReplacementRuleResult', { 'errors': [], 'data': obj })


    @event('getReplacementRules')
    @timer('getReplacementRules')
    @thrower('getReplacementRulesResult')
    def getReplacementRules(self):
      start_time = datetime.datetime.now()
      rules = self.rules.toJSON()
      elapsed_time = datetime.datetime.now() - start_time
      obj = { 'elapsedTime': timediff(elapsed_time), 'rules': rules }
      self.respond('getReplacementRulesResult', { 'errors': [], 'data': obj })


    @event('delReplacementRule')
    @timer('delReplacementRule')
    @thrower('delReplacementRuleResult')
    def delReplacementRule(self, data):
      start_time = datetime.datetime.now()
      self.rules.remove(data['ruleId'])
      elapsed_time = datetime.datetime.now() - start_time
      obj = { 'elapsedTime': timediff(elapsed_time) }
      self.respond('delReplacementRuleResult', { 'errors': [], 'data': obj })


    @event('applyReplacementRules')
    @timer('applyReplacementRules')
    @thrower('applyReplacementRulesResult')
    def applyReplacementRulesResult(self, data):
      print >> sys.stderr, 'data:', data
      source, target = to_utf8(data['source']), to_utf8(data['target'])

      start_time = datetime.datetime.now()
      source_tok, source_seg = models.source_processor.preprocess(source)
      if len(self.rules):
        target = self.rules.apply(self.source, target)
        target_tok, target_seg = models.target_processor.preprocess(target)

      elapsed_time = datetime.datetime.now() - start_time

      obj = {
              'source': source,
              'sourceSegmentation': source_seg,
              'target': target,
              'targetSegmentation': target_seg,
              'elapsedTime': timediff(elapsed_time)
            }
      self.respond('applyReplacementRulesResult', { 'errors': [], 'data': obj })


    @event('getTokens')
    @timer('getTokens')
    @thrower('getTokensResult')
    def getTokens(self, data):
      print >> sys.stderr, 'data:', data
      source, target = to_utf8(data['source']), to_utf8(data['target'])

      start_time = datetime.datetime.now()
      source_tok, source_seg = models.source_processor.preprocess(source)
      target_tok, target_seg = models.target_processor.preprocess(target)
      elapsed_time = datetime.datetime.now() - start_time

      obj = {
              'source': source,
              'sourceSegmentation': source_seg,
              'target': target,
              'targetSegmentation': target_seg,
              'elapsedTime': timediff(elapsed_time)
            }

      validated_words = [False]*len(target_tok)
      if models.option("confidencer", "delayed") == False:
        sent, conf = models.confidencer.getWordConfidences(source_tok, target_tok, validated_words)
        obj['confidences'] = conf
        obj['quality'] = sent

      if models.option("aligner", "delayed") == False:
        matrix = models.aligner.align(source_tok, target_tok)
        obj['alignments'] = matrix


      elapsed_time = datetime.datetime.now() - start_time
      obj['elapsedTime'] = timediff(elapsed_time)


      if 'caretPos' in data: obj['caretPos'] = data['caretPos']
      self.respond('getTokensResult', { 'errors': [], 'data': obj })

    @event('getAlignments')
    @timer('getAlignments')
    @thrower('getAlignmentsResult')
    def getAlignments(self, data):
      print >> sys.stderr, 'data:', data
      source, target = to_utf8(data['source']), to_utf8(data['target'])
      source_tok, source_seg = models.source_processor.preprocess(source)
      target_tok, target_seg = models.target_processor.preprocess(target)

      start_time = datetime.datetime.now()
      matrix = models.aligner.align(source_tok, target_tok)
      elapsed_time = datetime.datetime.now() - start_time

      logger.log(DEBUG_LOG, matrix);
      obj = { 'alignments': matrix,
              'source': source,
              'sourceSegmentation': source_seg,
              'target': target,
              'targetSegmentation': target_seg,
              'elapsedTime': timediff(elapsed_time)
            }
      self.respond('getAlignmentsResult', { 'errors': [], 'data': obj })


    @event('getConfidences')
    @timer('getConfidences')
    @thrower('getConfidencesResult')
    def getConfidencesResult(self, data):
      print >> sys.stderr, 'data:', data
      source, target = to_utf8(data['source']), to_utf8(data['target'])
      source_tok, source_seg = models.source_processor.preprocess(source)
      target_tok, target_seg = models.target_processor.preprocess(target)
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
        'elapsedTime': timediff(elapsed_time)
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
      source_tok, source_seg = models.source_processor.preprocess(source)
      print >> sys.stderr, "WGSENT", source, "->", "'" + " ".join(source_tok) + "'"
      contributions = new_contributions(source, source_seg)

      if self.config['mode'] and self.config['mode'] != "":
        mts = [models.get_system('mt', name) for name in self.config['mode'].split(",")]
      else:
        mts = [models.mt]
      mts = [ mt for mt in mts if mt ]
        
      if len(mts) == 0:
        pass
        # XXX: Raise exception?

      else:
        for mt in mts:
          start_time = datetime.datetime.now()
          target_tok = mt.translate(source_tok)
          target, target_seg = models.target_processor.postprocess(target_tok)
          elapsed_time = datetime.datetime.now() - start_time
          match = new_match(name, target, target_seg, elapsed_time)

          if len(self.rules):
            target = self.rules.apply(source, target)
            target_tok, target_seg = models.target_processor.preprocess(target)

          validated_words = [False]*len(target_tok)
          if models.option("confidencer", "delayed") == False:
            sent, conf = models.confidencer.getWordConfidences(source_tok, target_tok, validated_words)
            match['confidences'] = conf
          else:
            sent = models.confidencer.getSentenceConfidence(source_tok, target_tok, validated_words)

          if models.option("aligner", "delayed") == False:
            matrix = models.aligner.align(source_tok, target_tok)
            match['alignments'] = matrix


          elapsed_time = datetime.datetime.now() - start_time
          match['elapsedTime'] = timediff(elapsed_time)
          match['quality'] = sent
          add_match(contributions, match)
      prepare(contributions)
      self.respond('decodeResult', contributions)

    @event('validate')
    @timer('validate')
    @thrower('validateResults')
    def validate(self, data):
      source = to_utf8(data['source'])
      source_tok, source_seg = models.source_processor.preprocess(source)
      target = to_utf8(data['target'])
      target_tok, target_seg = models.target_processor.preprocess(target)
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
        imt = models.get_system('imt', name)
        if imt: imt.deleteSession(session)
        else: del session
      self.imt_session = {}

      source_tok, source_seg = models.source_processor.preprocess(self.source)
      self.source_tok, self.source_seg = source_tok, source_seg
      logger.log(DEBUG_LOG, "starting imt session with " + str(source_tok));

      start_time = datetime.datetime.now()

      if self.config['mode'] and self.config['mode'] != "":
        imts = [models.get_system('imt', name) for name in self.config['mode'].split(",")]
      else:
        imts = [models.imt]
      imts = [ imt for imt in imts if imt ]
        
      if len(imts) == 0:
        pass
        # XXX: Raise exception?

      else:
        for imt in imts:
          imt = models.get_system('imt', name)
          self.imt_session[name] = imt.newSession(source_tok)

      elapsed_time = datetime.datetime.now() - start_time
      obj = { 'elapsedTime': timediff(elapsed_time) }
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
      prediction, prediction_seg = models.target_processor.postprocess(prediction_tok)
    
      # so we split the new prediction at the point where the original cursor should be
      s = self.splitPoint(prediction_seg, prefix_last_tok, last_token_partial_len)
      r_pref, r_suf = split_utf8(prediction, s)
    
   
      # apply the replacement rules to the suffix
      if len(self.rules):
        print >> sys.stderr, 'XXXXX', prefix, '###', r_suf
        prediction = prefix + self.rules.apply(self.source, r_suf)
        prediction_tok, prediction_seg = models.target_processor.preprocess(prediction)
    
        # as the prefix might have changed, we need to restore if 
        s = self.splitPoint(prediction_seg, prefix_last_tok, last_token_partial_len)
        r_pref, r_suf = split_utf8(prediction, s)
    
      # if the new prefix is not the one given by the user then make it so
      if r_pref != prefix:
        print >> sys.stderr, 'XXXXX: tokenizer changed the prefix from "%s" o "%s"' % (prefix, r_pref)
        prediction = prefix + r_suf
     
        # now, we have a prediction with the user prefix. XXX: we assume the tokens are also correct
        # but we neeed to adjust the segmentation
    
        if prefix_last_tok >= 0 and prefix_last_tok + 1 < len(prediction_seg):
          # compute the non-token chars the user has introduced at the end of the prefix
          prefix_spaces = len_utf8(prefix) - prefix_seg[prefix_last_tok][1]
          print >> sys.stderr, "############## PREFIX '%s'" % prefix, prefix_last_tok, prefix_seg
          print >> sys.stderr, "############## PREFIX LEN", len_utf8(prefix), prefix_seg[prefix_last_tok][1]

          # compute the non-token chars from the last prefix token and the first suffix token
          suffix_spaces = prediction_seg[prefix_last_tok + 1][0] - prediction_seg[prefix_last_tok][1]

          # compute what is the actual number of non-tokens to be appended after the prefix
          spaces = max(0, suffix_spaces - prefix_spaces) 
          print >> sys.stderr, "############# SPACES", prefix_spaces, suffix_spaces, spaces

          if last_token_partial_len > 0:
            # if it is a partial word we must sum the length of the word suffix
            owl = prefix_seg[prefix_last_tok][1] - prefix_seg[prefix_last_tok][0]
            nwl = prediction_seg[prefix_last_tok][1] - prediction_seg[prefix_last_tok][0]
            spaces +=  nwl - owl 
            print >> sys.stderr, "############# LAST WORD SUFFIX", nwl, owl, nwl - owl 

          # we compute the prefix segmentation for the original prefix (the one given by the user)
          # the suffix of the last token might have changed
          orig_last_token_end = prefix_seg[prefix_last_tok][0] + len_utf8(prediction_tok[prefix_last_tok])
          prefix_seg = [s for s in prefix_seg[:prefix_last_tok]] + [(prefix_seg[prefix_last_tok][0], orig_last_token_end)]
    
          # thus, we need to move the suffix by
          diff = len_utf8(prefix) + spaces - prediction_seg[prefix_last_tok + 1][0]
          print >> sys.stderr, "############## DIFF", diff
          print >> sys.stderr, "############## PREDICTION SEG", prediction_seg[prefix_last_tok + 1][0], prediction, prediction_seg 

          #diff = len_utf8(prefix) - prefix_seg[prefix_last_tok][1] + orig_last_token_end - new_last_token_end
          #       original prefix seg.,    we need to adjust the suffix with the new prefix length
          prediction_seg = prefix_seg +  [(s[0]+diff, s[1]+diff) for s in prediction_seg[prefix_last_tok + 1:]]
          print >> sys.stderr, "############## FINAL PREDICTION SEG", prediction_seg 
    
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

      prefix_tok, prefix_seg = models.target_processor.preprocess(prefix)
      suffix_tok, suffix_seg = models.target_processor.preprocess(suffix)

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

          if models.option("confidencer", "delayed") == False:
            validated_words = [True] * len(prefix_tok)
            validated_words.extend([False]*(len(prediction_tok) - len(prefix_tok)))
            sent, conf = models.confidencer.getWordConfidences(self.source_tok, prediction_tok, validated_words)
            match['confidences'] = conf
            match['quality'] = sent

          if models.option("aligner", "delayed") == False:
            matrix = models.aligner.align(self.source_tok, prediction_tok)
            match['alignments'] = matrix

          if "prioritizer" in self.config and self.source_tok:
            prioritizer = models.get_system("prioritizer", self.config["prioritizer"])
            if prioritizer:
              wp = models.word_prioritizers[self.config["prioritizer"]]
              n_ok = len(prefix_tok)
              if last_token_is_partial:
                n_ok -= 1
              validated = [True]*n_ok + [False]*(len(prediction_tok) - n_ok)
              priority = wp.word_prioritizer.getWordPriorities(self.source_tok, prediction_tok, validated)
              match["priorities"] = priority

          elapsed_time = datetime.datetime.now() - start_time
          match['elapsedTime'] = timediff(elapsed_time)
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

      prefix_tok, prefix_seg = models.target_processor.preprocess(prefix)
      suffix_tok, suffix_seg = models.target_processor.preprocess(suffix)

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

          if models.option("confidencer", "delayed") == False:
            validated_words = [True] * len(prefix_tok)
            validated_words.extend([False]*(len(prediction_tok) - len(prefix_tok)))
            sent, conf = models.confidencer.getWordConfidences(self.source_tok, prediction_tok, validated_words)
            match['confidences'] = conf
            match['quality'] = sent

          if models.option("aligner", "delayed") == False:
            matrix = models.aligner.align(self.source_tok, prediction_tok)
            match['alignments'] = matrix

          if "prioritizer" in self.config and self.source_tok:
            prioritizer = models.get_system("prioritizer", self.config["prioritizer"])
            if prioritizer:
              wp = models.word_prioritizers[self.config["prioritizer"]]
              n_ok = len(prefix_tok)
              if last_token_is_partial:
                n_ok -= 1
              validated = [True]*n_ok + [False]*(len(prediction_tok) - n_ok)
              priority = wp.word_prioritizer.getWordPriorities(self.source_tok, prediction_tok, validated)
              match["priorities"] = priority

          elapsed_time = datetime.datetime.now() - start_time
          match['elapsedTime'] = timediff(elapsed_time)
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
        next((imt for n, imt in models.systems['imt'] if n == name)).deleteSession(session)
      self.imt_session = {}
      logger.log(DEBUG_LOG, "ending imt session");

      elapsed_time = datetime.datetime.now() - start_time
      obj = { 'elapsedTime': timediff(elapsed_time) }
      self.respond('endSessionResult', { 'errors': [], 'data': obj })

    @event('reset')
    @timer('reset')
    @thrower('resetResult')
    def reset(self):
      start_time = datetime.datetime.now()
      models.reset()
      elapsed_time = datetime.datetime.now() - start_time
      obj = { 'elapsedTime': timediff(elapsed_time) }
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
      #self.config = { 'useSuggestions': False, 'mode': u'PE' }
      self.config = { 'useSuggestions': True, 'mode': u'ITP' }
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
    config_fn = "" 
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

    config_log(log_fn)

    logging.getLogger().setLevel(logging.INFO)


    if not os.path.isfile(config_fn): 
      raise Exception("Missing config file")

    models = casmacat_models.Models(config_fn)
    print >> get_logfd(), "config", json.dumps(models.config)
    models.create_plugins()
    atexit.register(models.delete_plugins)


    port = 3019
    try:
      port = int(args[0])
    except:
      try:
        port = models.config["server"]["port"]
      except:
        pass


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


    print >> get_logfd(), """/*\n  Casmacat server started on port %d\n  %s\n*/\n\n"config": %s\n\n\n""" % (port, str(datetime.datetime.now()), json.dumps(models.config, indent=2, separators=(',', ': '), encoding="utf-8"))

    # Create and start tornadio server
    SocketServer(application)


