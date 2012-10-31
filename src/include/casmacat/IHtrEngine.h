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
 * IHtrEngine.h
 *
 *  Created on: 15/10/2012
 *      Author: valabau
 */

#ifndef CASMACAT_IHTRENGINE_H_
#define CASMACAT_IHTRENGINE_H_

#include <string>
#include <vector>
#include <casmacat/IPluginFactory.h>


namespace casmacat {

/**
 * Interface for Machine Translation plug-ins
 */

  class IHtrSession {
  public:
    typedef enum { PEN_UP, PEN_DOWN } stroke_type_t;

    virtual ~IHtrSession() {};

    /* Set partial validation of a translation */
    virtual void addPoint(float x, float y, stroke_type_t type) = 0;

    /* Set prefix of a translation */
    virtual void decode(std::vector<std::string> &corrected_suffix_out) = 0;
  };

  class IHtrEngine {
  public:
    virtual ~IHtrEngine() {};

    /**
     * create new HTR session from a validated prefix and not validated suffix
     */
    virtual IHtrSession *createSessionFromPrefix(const std::vector<std::string> &source,
                                                 const std::vector<std::string> &prefix,
                                                 const std::vector<std::string> &suffix,
                                                 const bool last_token_is_partial
                                                ) = 0;

    /**
     * delete HTR session
     */
    virtual void deleteSession(IHtrEngine *session) = 0;

  };

  typedef IPluginFactory<IHtrEngine> IHtrFactory;
}



#endif /* CASMACAT_IHTRENGINE_H_ */