/*
 *   Copyright 2012, valabau
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 * 
 * space-tokenizer.cpp
 *
 *  Created on: 14/09/2012
 *      Author: valabau
 */

#include <fstream>
#include <iostream>
#include <sstream>
#include <vector>
#include <cstdlib>
#include <ctime>
#include <cmath>


#include <casmacat/config.h>
#include <casmacat/ITextProcessor.h>
#include <casmacat/plugin-utils.h>
#include <casmacat/utils.h>

using namespace std;
using namespace casmacat;


size_t utf8_char_length(char oc) {
  unsigned char ch = static_cast<unsigned char>(0xff & oc);
  if (ch < 0x80)
    return 1;
  else if ((ch >> 5) == 0x6)
    return 2;
  else if ((ch >> 4) == 0xe)
    return 3;
  else if ((ch >> 3) == 0x1e)
    return 4;
  else
    return 0;
}

size_t utf8_distance(string::const_iterator begin, const string::const_iterator& end) {
  size_t dist = 0;

  while (begin < end) {
    dist++;
    advance(begin, utf8_char_length(*begin));
  }

  return dist;
}

size_t utf8_size(const string& str) {
  return utf8_distance(str.begin(), str.end());
}

class SpaceTokenizer: public ITextProcessor {
  string delimiters;
public:
  SpaceTokenizer(): delimiters(" ") { }
  SpaceTokenizer(const string &_delimiters): delimiters(_delimiters) { }
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~SpaceTokenizer() { cerr << "I, " << typeid(*this).name() <<  ", am free!!!" << endl; };

  virtual void preprocess(const std::string &detokenized,
                          std::vector<std::string> &tokenized,
                          std::vector< std::pair<size_t, size_t> > &segmentation_out)
  {
    tokenized.clear();
    segmentation_out.clear();
    if (delimiters == "") {
      tokenized.reserve(detokenized.size());
      int i = 0;
      for (string::const_iterator it = detokenized.begin(); it != detokenized.end(); ++it, ++i) {
        string tok;
        size_t char_len = utf8_char_length(*it);
        copy(it, it + char_len, back_inserter(tok));
        segmentation_out.push_back(make_pair(i, i+1));
        tokenized.push_back(tok);
        it += char_len - 1;
      }
    }
    else {
      tokenized.clear();

      // Skip delimiters at beginning.
      typename string::size_type last_pos = detokenized.find_first_not_of(delimiters, 0);
      // Find first "non-delimiter".
      typename string::size_type pos     = detokenized.find_first_of(delimiters, last_pos);

      while (string::npos != pos || string::npos != last_pos) {
        // Found a token, add it to the vector.
        tokenized.push_back(detokenized.substr(last_pos, pos - last_pos));

        size_t seg_last_pos = utf8_distance(detokenized.begin(), detokenized.begin() + last_pos);
        size_t seg_pos = utf8_distance(detokenized.begin(), (pos != string::npos)?(detokenized.begin() + pos):detokenized.end());

        segmentation_out.push_back(make_pair(seg_last_pos, seg_pos));
        // Skip delimiters.  Note the "not_of"
        last_pos = detokenized.find_first_not_of(delimiters, pos);
        // Find next "non-delimiter"
        pos = detokenized.find_first_of(delimiters, last_pos);
      }
    }
  }

  virtual void postprocess(const std::vector<std::string> &tokenized,
                            std::string &detokenized,
                            std::vector< std::pair<size_t, size_t> > &segmentation)
  {
    segmentation.resize(tokenized.size());

    stringstream ss;
    size_t pos = 0;
    for (size_t i = 0; i < tokenized.size(); i++) {
      segmentation[i].first = pos;
      ss << tokenized[i];
      pos = utf8_size(ss.str());
      segmentation[i].second = pos;
      if (i + 1 != tokenized.size()) {
        ss << " ";
        pos++;
      }
    }
    detokenized = ss.str();
  }


};

class SpaceTokenizerFactory: public ITextProcessorFactory {
  string delimiters;
public:
  SpaceTokenizerFactory(): delimiters(" ") { }
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~SpaceTokenizerFactory() { cerr << "I, " << typeid(*this).name() <<  ", am free!!!" << endl; };

  virtual int init(int argc, char *argv[], Context *context = 0) {
    // invalid number of arguments
    if (argc > 2) { return EXIT_FAILURE; }
    if (argc == 2) { delimiters = argv[1]; }
    return EXIT_SUCCESS;
  }

  virtual string getVersion() { return PACKAGE_VERSION; }

  virtual ITextProcessor *createInstance(const std::string &specialization_id = "") {
    return new SpaceTokenizer(delimiters);
  }
};

EXPORT_CASMACAT_PLUGIN(ITextProcessor, SpaceTokenizerFactory);
