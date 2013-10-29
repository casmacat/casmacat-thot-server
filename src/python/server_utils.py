# -*- coding: utf-8 -*-

from casmacat import *
import collections
import datetime, time, traceback
import os.path, sys, math, codecs
try: import simplejson as json
except ImportError: import json

logfd = sys.stderr

def config_log(log_fn):
  global logfd
  if log_fn:
    logfd = codecs.open(log_fn, "a", "utf-8")
  else:
    logfd = codecs.open(os.path.devnull, "a", "utf-8")

def get_logfd():
  global logfd
  return logfd

profiler_callback = None
def setup_profiler_notifications(callback):
  global profiler_callback
  profiler_callback = callback

def notify_profiler(connection, info):
  profiler_callback(connection, info)

server_start_time = datetime.datetime.now()
def timesecs(elapsed_time):
  return elapsed_time.seconds + elapsed_time.microseconds/1000.0

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
      norm = 1024*1024
      m1, r1, s1 = memory(), resident(), stacksize()
      print >> sys.stderr, "TIME:%s:started" % (self.name)
      start_time = datetime.datetime.now()

      print >> logfd, """/*\n  Server method "%s" invoked\n  %s\n*/\n\n"%s": %s\n""" % (self.name, str(datetime.datetime.now()), self.name, json.dumps(kwargs, indent=2, separators=(',', ': '), encoding="utf-8"))

      ret = function(*args, **kwargs)
      elapsed_time = datetime.datetime.now() - start_time
      m2, r2, s2 = memory(), resident(), stacksize()
      print >> sys.stderr, "MEMORY:%g(M):%g(R):%g(S)" % ((m2-m1)/norm,(r2-r1)/norm,(s2-s1)/norm)
      print >> logfd, """/* Memory used:  memory: %g, resident: %g, stacksize: %g */\n""" % ((m2-m1)/norm,(r2-r1)/norm,(s2-s1)/norm)
      print >> logfd, """/* Total usage:  memory: %g, resident: %g, stacksize: %g */\n""" % (m2/norm,r2/norm,s2/norm)
      print >> sys.stderr, "TIME:%s:%s" % (self.name, fmt_delta(elapsed_time))
      print >> logfd, """/* Time to process method "%s": %s */\n\n\n""" % (self.name, fmt_delta(elapsed_time))

      notify_profiler(args[0], { 
        'name': self.name, 
        'timestamp': timesecs(datetime.datetime.now() - server_start_time),
        'elapsedTime': timesecs(elapsed_time),
        'memory': m2, 'resident': r2, 'stacksize': s2,
        'memoryDelta': m2-m1, 'residentDelta': r2-r1, 'stacksizeDelta': s2-s1
      })
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

import os
_proc_status = '/proc/%d/status' % os.getpid()

_scale = {'kB': 1024.0, 'mB': 1024.0*1024.0,
          'KB': 1024.0, 'MB': 1024.0*1024.0}

def _VmB(VmKey):
    '''Private.
    '''
    global _proc_status, _scale
     # get pseudo file  /proc/<pid>/status
    try:
        t = open(_proc_status)
        v = t.read()
        t.close()
    except:
        return 0.0  # non-Linux?
     # get VmKey line e.g. 'VmRSS:  9999  kB\n ...'
    i = v.index(VmKey)
    v = v[i:].split(None, 3)  # whitespace
    if len(v) < 3:
        return 0.0  # invalid format?
     # convert Vm value to bytes
    return float(v[1]) * _scale[v[2]]


def memory(since=0.0):
    '''Return memory usage in bytes.
    '''
    return _VmB('VmSize:') - since


def resident(since=0.0):
    '''Return resident memory usage in bytes.
    '''
    return _VmB('VmRSS:') - since


def stacksize(since=0.0):
    '''Return stack size in bytes.
    '''
    return _VmB('VmStk:') - since


