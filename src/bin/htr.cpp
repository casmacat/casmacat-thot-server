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
 * translate.cpp
 *
 *  Created on: 21/06/2012
 *      Author: valabau
 */



#include <cstdlib>
#include <casmacat/compat.h>
#include <casmacat/utils.h>
#include <casmacat/IHtrEngine.h>
#include <casmacat/Plugin.h>
#include <iostream>
#include <fstream>
#include <sstream>
#include <iterator>
#include <cassert>

using namespace casmacat;
using namespace std;

int main(int argc, char* argv[]) {


    string htr_plugin_fn = "/home/valabau/work/software/casmacat-server-library/server/plugins/iatros-plugin.so";
    string args = "-c /home/valabau/corpora/xerox/epen/xerox.en.conf";

    Plugin<IHtrFactory> htr_plugin(htr_plugin_fn, args);
    IHtrFactory *htr_factory = htr_plugin.create();
    IHtrEngine *htr = htr_factory->createInstance();

    if (htr == 0) {
      cerr << "Plugin could not be instantiated\n";
    }
    else {
      cerr << "Plugin loaded\n";

      for (int i = 1; i < argc; i++) {
        ifstream file(argv[i]);
        string source, prefix, suffix;
        vector<string> tok_source, tok_prefix, tok_suffix;

        while(getline(file, source)) {
          tokenize(source, tok_source);
          string features_fn = tok_source.back();
          tok_source.pop_back();


          ifstream feat_file(features_fn.c_str());
          string line;
          float x, y; bool pen_up;

          getline(feat_file, prefix);
          tokenize(prefix, tok_prefix);
          getline(feat_file, suffix);
          tokenize(suffix, tok_suffix);

          cerr << "source: " << source << "\n";
          cerr << "prefix: " << prefix << "\n";
          cerr << "suffix: " << suffix << "\n";

          vector<string> tok_empty;
          IHtrSession *session = htr->createSessionFromPrefix(tok_empty, tok_empty, tok_empty, false);
//          IHtrSession *session = htr->createSessionFromPrefix(tok_source, tok_prefix, tok_suffix, false);
          while(getline(feat_file, line)) {
            istringstream sline(line);
            if (sline >> x >> y >> pen_up) {
              session->addPoint(x, y, IHtrSession::stroke_type_t(pen_up));
            }
          }

          vector<string> output;
          session->decode(output);

          cout << source << "|||";
          copy(output.begin(), output.end(), ostream_iterator<string>(cout, " "));
          cout << "\n";
        }
      }
    }


    return EXIT_SUCCESS;
}


